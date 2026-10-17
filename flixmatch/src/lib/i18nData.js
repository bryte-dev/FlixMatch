export const LANGUAGES = {
  fr: "Français", en: "English", es: "Español", de: "Deutsch", it: "Italiano", pt: "Português", nl: "Nederlands",
  pl: "Polski", tr: "Türkçe", ru: "Русский", ja: "日本語", ko: "한국어", zh: "中文", ar: "العربية",
};
export const RTL = new Set(["ar"]);
export const DEFAULT_LANG = "fr";

// Chaque clé absente d'une langue retombe sur le français.
export const DICT = {
  fr: { home: "Accueil", discover: "Découverte", search: "Recherche", advancedSearch: "Recherche avancée", watchlist: "À voir", favorites: "Favoris", seen: "Vus", trash: "Corbeille", profile: "Profil", settings: "Paramètres", account: "Mon compte", login: "Connexion", signup: "S'inscrire", activity: "Activité des amis", uiLanguage: "Langue de l'interface" },
  en: { home: "Home", discover: "Discover", search: "Search", advancedSearch: "Advanced search", watchlist: "Watchlist", favorites: "Favorites", seen: "Seen", trash: "Trash", profile: "Profile", settings: "Settings", account: "My account", login: "Log in", signup: "Sign up", activity: "Friends activity", uiLanguage: "Interface language" },
  es: { home: "Inicio", discover: "Descubrir", search: "Buscar", advancedSearch: "Búsqueda avanzada", watchlist: "Por ver", favorites: "Favoritos", seen: "Vistos", trash: "Papelera", profile: "Perfil", settings: "Ajustes", account: "Mi cuenta", login: "Iniciar sesión", signup: "Registrarse", activity: "Actividad de amigos", uiLanguage: "Idioma de la interfaz" },
  de: { home: "Start", discover: "Entdecken", search: "Suche", advancedSearch: "Erweiterte Suche", watchlist: "Merkliste", favorites: "Favoriten", seen: "Gesehen", trash: "Papierkorb", profile: "Profil", settings: "Einstellungen", account: "Mein Konto", login: "Anmelden", signup: "Registrieren", activity: "Aktivität der Freunde", uiLanguage: "Sprache der Oberfläche" },
  it: { home: "Home", discover: "Scopri", search: "Cerca", advancedSearch: "Ricerca avanzata", watchlist: "Da vedere", favorites: "Preferiti", seen: "Visti", trash: "Cestino", profile: "Profilo", settings: "Impostazioni", account: "Il mio account", login: "Accedi", signup: "Registrati", activity: "Attività degli amici", uiLanguage: "Lingua dell'interfaccia" },
  pt: { home: "Início", discover: "Descobrir", search: "Pesquisa", advancedSearch: "Pesquisa avançada", watchlist: "Para ver", favorites: "Favoritos", seen: "Vistos", trash: "Lixo", profile: "Perfil", settings: "Definições", account: "A minha conta", login: "Entrar", signup: "Registar", activity: "Atividade dos amigos", uiLanguage: "Idioma da interface" },
  nl: { home: "Home", discover: "Ontdekken", search: "Zoeken", advancedSearch: "Geavanceerd zoeken", watchlist: "Kijklijst", favorites: "Favorieten", seen: "Gezien", trash: "Prullenbak", profile: "Profiel", settings: "Instellingen", account: "Mijn account", login: "Inloggen", signup: "Registreren", activity: "Activiteit van vrienden", uiLanguage: "Interfacetaal" },
  pl: { home: "Start", discover: "Odkrywaj", search: "Szukaj", advancedSearch: "Wyszukiwanie zaawansowane", watchlist: "Do obejrzenia", favorites: "Ulubione", seen: "Obejrzane", trash: "Kosz", profile: "Profil", settings: "Ustawienia", account: "Moje konto", login: "Zaloguj", signup: "Zarejestruj", activity: "Aktywność znajomych", uiLanguage: "Język interfejsu" },
  tr: { home: "Ana sayfa", discover: "Keşfet", search: "Ara", advancedSearch: "Gelişmiş arama", watchlist: "İzlenecekler", favorites: "Favoriler", seen: "İzlenenler", trash: "Çöp", profile: "Profil", settings: "Ayarlar", account: "Hesabım", login: "Giriş yap", signup: "Kaydol", activity: "Arkadaş etkinliği", uiLanguage: "Arayüz dili" },
  ru: { home: "Главная", discover: "Открытия", search: "Поиск", advancedSearch: "Расширенный поиск", watchlist: "К просмотру", favorites: "Избранное", seen: "Просмотрено", trash: "Корзина", profile: "Профиль", settings: "Настройки", account: "Мой аккаунт", login: "Войти", signup: "Регистрация", activity: "Активность друзей", uiLanguage: "Язык интерфейса" },
  ja: { home: "ホーム", discover: "発見", search: "検索", advancedSearch: "詳細検索", watchlist: "観たい", favorites: "お気に入り", seen: "視聴済み", trash: "ゴミ箱", profile: "プロフィール", settings: "設定", account: "マイアカウント", login: "ログイン", signup: "登録", activity: "友達のアクティビティ", uiLanguage: "表示言語" },
  ko: { home: "홈", discover: "탐색", search: "검색", advancedSearch: "고급 검색", watchlist: "볼 예정", favorites: "즐겨찾기", seen: "본 작품", trash: "휴지통", profile: "프로필", settings: "설정", account: "내 계정", login: "로그인", signup: "가입", activity: "친구 활동", uiLanguage: "인터페이스 언어" },
  zh: { home: "首页", discover: "发现", search: "搜索", advancedSearch: "高级搜索", watchlist: "想看", favorites: "收藏", seen: "已看", trash: "回收站", profile: "个人资料", settings: "设置", account: "我的账户", login: "登录", signup: "注册", activity: "好友动态", uiLanguage: "界面语言" },
  ar: { home: "الرئيسية", discover: "اكتشف", search: "بحث", advancedSearch: "بحث متقدم", watchlist: "للمشاهدة", favorites: "المفضلة", seen: "تمت مشاهدته", trash: "المهملات", profile: "الملف الشخصي", settings: "الإعدادات", account: "حسابي", login: "تسجيل الدخول", signup: "إنشاء حساب", activity: "نشاط الأصدقاء", uiLanguage: "لغة الواجهة" },
};

export const translate = (lang, key) => DICT[lang]?.[key] ?? DICT[DEFAULT_LANG][key] ?? key;

