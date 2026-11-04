import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { FiCornerDownRight, FiTrash2 } from "react-icons/fi";
import { API_URL } from "../api";
import { useToast } from "../toastContext";
import { useT } from "../i18n";
import useBusy from "../hooks/useBusy";
import { Button, ErrorState, StarRating } from "./ui";
import { errorMessage, formatDate } from "../utils";

function ReplyForm({ placeholder, pending, onSubmit, onCancel }) {
  const t = useT();
  const [text, setText] = useState("");
  const id = useId();
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        if (await onSubmit(text.trim())) setText("");
      }}
    >
      <label className="sr-only" htmlFor={id}>{placeholder}</label>
      <textarea id={id} rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="field resize-y" />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" pending={pending} pendingLabel={t("rvSending")} disabled={!text.trim()}>{t("rvSend")}</Button>
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>{t("cancel")}</Button>}
      </div>
    </form>
  );
}

function ReviewItem({ review, depth, user, post, onDeleted }) {
  const toast = useToast();
  const t = useT();
  const { isBusy, run } = useBusy();
  const [replies, setReplies] = useState(null);
  const [replyCount, setReplyCount] = useState(review._count?.replies ?? 0);
  const [nextCursor, setNextCursor] = useState(null);
  const [showReplies, setShowReplies] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOwner = Boolean(user && review.user?.id === user.id);

  const loadReplies = (cursor) =>
    run("load", async () => {
      try {
        const res = await axios.get(`${API_URL}/reviews/${review.id}/replies`, {
          params: { limit: 10, ...(cursor ? { cursor } : {}) },
        });
        setReplies((prev) => [...(cursor ? prev || [] : []), ...res.data.replies]);
        setNextCursor(res.data.hasMore ? res.data.nextCursor : null);
        setShowReplies(true);
      } catch (err) {
        toast(errorMessage(err, t("rvLoadRepliesFail")), "error");
      }
    });

  const toggleReplies = () => {
    if (showReplies) setShowReplies(false);
    else if (replies) setShowReplies(true);
    else loadReplies();
  };

  const submitReply = (comment) =>
    run("reply", async () => {
      try {
        const res = await post({ comment, parentId: review.id });
        setReplies((prev) => [...(prev || []), res.data.review]);
        setReplyCount((c) => c + 1);
        setShowReplies(true);
        setReplyOpen(false);
        toast(t("rvReplyPosted"), "success");
        return true;
      } catch (err) {
        toast(errorMessage(err, t("rvReplyFail")), "error");
        return false;
      }
    });

  const remove = () =>
    run("delete", async () => {
      try {
        await axios.delete(`${API_URL}/reviews/${review.id}`);
        toast(t("rvDeleted"), "success");
        onDeleted(review.id);
      } catch (err) {
        setConfirmDelete(false);
        toast(errorMessage(err, t("rvDeleteFail")), "error");
      }
    });

  return (
    <li className={depth > 0 ? "mt-3 border-l border-white/10 pl-4" : "surface p-4 sm:p-5"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{review.user?.username || t("rvUser")}</span>
        {review.rating ? <StarRating value={review.rating} label={t("rvRatingLabel")} /> : null}
        <span className="text-xs text-zinc-500">{formatDate(review.createdAt)}</span>
      </div>
      <p className="mt-2 whitespace-pre-line break-words text-zinc-200">{review.comment}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1">
        {user && (
          <Button size="sm" variant="ghost" onClick={() => setReplyOpen((o) => !o)} aria-expanded={replyOpen}>
            <FiCornerDownRight aria-hidden="true" /> {t("rvReply")}
          </Button>
        )}
        {replyCount > 0 && (
          <Button size="sm" variant="ghost" pending={isBusy("load")} onClick={toggleReplies} aria-expanded={showReplies}>
            {showReplies ? t("rvHide") : t("rvShow")} {t(replyCount > 1 ? "rvReplyMany" : "rvReplyOne", { n: replyCount })}
          </Button>
        )}
        {isOwner &&
          (confirmDelete ? (
            <span className="ml-auto flex items-center gap-1 text-sm">
              <span className="text-zinc-400">{t("rvDeleteQ")}</span>
              <Button size="sm" variant="danger" pending={isBusy("delete")} pendingLabel="…" onClick={remove}>{t("rvYes")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>{t("rvNo")}</Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" className="ml-auto !text-zinc-500 hover:!text-red-300" onClick={() => setConfirmDelete(true)} aria-label={t("rvDeleteMine")}>
              <FiTrash2 aria-hidden="true" /> Supprimer
            </Button>
          ))}
      </div>

      {replyOpen && (
        <ReplyForm
          placeholder={t("rvReplyTo", { name: review.user?.username || t("rvThisReview") })}
          pending={isBusy("reply")}
          onSubmit={submitReply}
          onCancel={() => setReplyOpen(false)}
        />
      )}

      {showReplies && replies && (
        <ul>
          {replies.map((reply) => (
            <ReviewItem
              key={reply.id}
              review={reply}
              depth={depth + 1}
              user={user}
              post={post}
              onDeleted={(id) => {
                setReplies((prev) => prev.filter((r) => r.id !== id));
                setReplyCount((c) => Math.max(0, c - 1));
              }}
            />
          ))}
          {nextCursor && (
            <li className="mt-2">
              <Button size="sm" variant="ghost" pending={isBusy("load")} onClick={() => loadReplies(nextCursor)}>{t("rvMoreReplies")}</Button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export default function ReviewSection({ tmdbId, type, title, posterPath, user, onAverageChange }) {
  const toast = useToast();
  const t = useT();
  const { isBusy, run } = useBusy();
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState(false);
  const [avg, setAvg] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await axios.get(`${API_URL}/reviews/${tmdbId}`, { params: { type } });
      setReviews(res.data.reviews || []);
      setAvg(res.data.avgRating);
      onAverageChange?.(res.data.avgRating);
    } catch (err) {
      console.error("Erreur avis :", err);
      setError(true);
    }
  }, [tmdbId, type, onAverageChange]);

  useEffect(() => {
    load();
  }, [load]);

  const post = (extra) =>
    axios.post(`${API_URL}/reviews`, {
      movieId: tmdbId,
      title,
      media_type: type,
      poster_path: posterPath || "",
      ...extra,
    });

  const submitReview = (e) => {
    e.preventDefault();
    if (!rating) return toast(t("rvPickRating"), "error");
    if (!comment.trim()) return toast(t("rvWriteFirst"), "error");
    return run("review", async () => {
      try {
        await post({ comment: comment.trim(), rating });
        setRating(0);
        setComment("");
        toast(t("rvPublished"), "success");
        await load();
      } catch (err) {
        toast(errorMessage(err, t("rvPublishFail")), "error");
      }
    });
  };

  const handleDeleted = (id) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    load();
  };

  return (
    <section aria-labelledby="avis-titre">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 id="avis-titre" className="text-2xl font-bold">{t("rvTitle")}</h2>
        {avg != null && (
          <span className="chip !border-amber-400/30 !text-amber-300">★ {avg.toFixed(1)} / 5 · FlixMatch</span>
        )}
      </div>

      {user ? (
        <form onSubmit={submitReview} className="surface mb-6 space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-zinc-300">{t("rvYourRating")}</span>
            <StarRating value={rating} onChange={setRating} label={t("rvYourRating")} />
          </div>
          <label className="sr-only" htmlFor="nouvel-avis">{t("rvYourReview")}</label>
          <textarea id="nouvel-avis" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("rvPlaceholder")} className="field resize-y" />
          <Button type="submit" variant="primary" pending={isBusy("review")} pendingLabel={t("rvPublishing")}>{t("rvPublishBtn")}</Button>
        </form>
      ) : (
        <p className="surface mb-6 p-4 text-sm text-zinc-300">
          <Link to="/login" className="font-semibold text-brand-300 hover:underline">{t("rvLogin")}</Link>{t("rvLoginPost")}
        </p>
      )}

      {error ? (
        <ErrorState message={t("rvLoadFail")} onRetry={load} />
      ) : !reviews ? (
        <div className="space-y-3" role="status" aria-label={t("rvLoadingAria")}>
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="py-6 text-center text-zinc-400">{t("rvNone")}</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <ReviewItem key={review.id} review={review} depth={0} user={user} post={post} onDeleted={handleDeleted} />
          ))}
        </ul>
      )}
    </section>
  );
}
