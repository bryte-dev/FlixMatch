import { tvTimeAdapter } from "./tvtime.js";

// Adaptateurs d'import : ajouter ici Letterboxd, Trakt… (même interface : parse(files) -> { series, movies, stats })
export const ADAPTERS = [tvTimeAdapter];
