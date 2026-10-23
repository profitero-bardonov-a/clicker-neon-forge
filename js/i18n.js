const STORAGE_KEY = "neon-forge-locale";
const MANUAL_KEY = "neon-forge-locale-manual";

/** @typedef {"en" | "ru" | "es" | "de" | "fr"} Locale */

/** @type {Record<Locale, string>} */
export const LOCALE_LABELS = {
  en: "English",
  ru: "Русский",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
};

/** @type {Record<Locale, Record<string, string>>} */
const MESSAGES = {
  en: {
    title: "Neon Forge — Free Online Clicker Game",
    metaDescription:
      "Play Neon Forge free in your browser — a neon clicker with chaotic power-ups, rising combos, lottery cubes, and a global leaderboard. Sign in with Google, climb the ranks, no download.",
    installApp: "Install app",
    installHowto:
      "To install Neon Forge: open your browser menu and choose “Install app” or “Add to Home Screen”.",
    aboutOpen: "About the game",
    contactLabel: "Contact us",
    aboutClose: "Close",
    aboutIntro:
      "Neon Forge is a free online clicker you can play instantly in the browser. Tap the neon cube, ride chaotic power-ups, survive nasty debuffs, and push your score onto the global leaderboard.",
    aboutHowTitle: "How to play",
    aboutHow1: "Tap or click the cube to earn clicks.",
    aboutHow2: "Watch for timed effects: multipliers, combos, lottery cubes, flying photos, and traps.",
    aboutHow3: "Hits raise your score; misses and idle drain can cut it down.",
    aboutHow4:
      "A random nickname saves your score to the leaderboard. Sign in with Google to move that score to your account.",
    aboutHow5: "Switch language in the menu — English, Русский, Español, Deutsch, Français.",
    aboutFeaturesTitle: "Features",
    aboutFeat1: "Instant play, no install",
    aboutFeat2: "Neon cyber-forge look and feel",
    aboutFeat3: "Random positive and negative effects",
    aboutFeat4: "Rising combo, number-order challenges, split lottery",
    aboutFeat5: "Global leaderboard (top players)",
    aboutFeat6: "Google sign-in and cloud score sync",
    aboutFeat7: "Mobile and desktop browser support",
    aboutFeat8: "5 languages built in",
    aboutEffectsTitle: "Effects",
    aboutEffects:
      "Effects shake up every run: click multipliers, rising combos, numbered cubes in order, twin lottery with huge swings, flying photos, shrinking wander cubes, inverted clicks, and photo shields. Master the chaos to climb Neon Forge.",
    aboutWhyTitle: "Why play",
    aboutWhy:
      "Looking for a free browser clicker with real competition? Neon Forge keeps sessions short, tense, and shareable — perfect for a quick high-score chase or a longer grind against the leaderboard.",
    aboutFaqTitle: "FAQ",
    aboutFaq1Q: "Is Neon Forge free?",
    aboutFaq1A: "Yes. Neon Forge is a free online clicker — play in your browser with no download or payment.",
    aboutFaq2Q: "Do I need an account?",
    aboutFaq2A:
      "No. This device gets a random nickname that saves your score and shows it on the leaderboard. Sign in with Google to move that score to your Google account.",
    aboutFaq3Q: "Does Neon Forge work on phones?",
    aboutFaq3A: "Yes. It runs in mobile and desktop browsers as a lightweight web clicker.",
    aboutFaq4Q: "What makes Neon Forge different from other clickers?",
    aboutFaq4A:
      "Timed chaotic effects — multipliers, combos, lottery twins, and traps — so every run feels different, plus a live leaders board.",
    aboutFaq5Q: "Which languages are supported?",
    aboutFaq5A: "English, Russian, Spanish, German, and French.",
    canvasLabel: "Clicker canvas",
    leaders: "LEADERS",
    leadersExpand: "Expand leaders",
    leadersCollapse: "Collapse leaders",
    resumePause: "Resume",
    clicks: "CLICKS",
    signInGoogle: "Sign in with Google",
    signOut: "Sign out",
    updating: "Updating…",
    offline: "Offline",
    online: "Online",
    emptyLeaders: "No scores yet — be first.",
    player: "Player",
    langLabel: "Language",
    menuTitle: "Menu",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    logoutConfirmTitle: "Sign out?",
    logoutConfirmBody: "Your score stays on this device and in your account.",
    cancel: "Cancel",
    effectX2: "CLICK ×{x}",
    effectX3: "CLICK ×{x}",
    effectFlyingPhoto: "SMACK THAT PIC ×{x}",
    effectShrinkWander: "TINY MOVING CUBE",
    effectInvert: "INVERTED CLICKS",
    effectCoverPhoto: "COVER PHOTO",
    effectSplitTwins: "SPLIT CUBES",
    effectSplitLottery: "LOTTERY",
    effectRisingCombo: "COMBO +{x}",
    effectNumberOrder: "NEXT {x}",
    tapHint: "Tap the cube",
  },
  ru: {
    title: "Neon Forge — бесплатный онлайн-кликер",
    metaDescription:
      "Neon Forge — бесплатный кликер в браузере: неоновый куб, хаотичные эффекты, комбо, лотерея и таблица лидеров. Войди через Google и соревнуйся онлайн без скачивания.",
    installApp: "Установить приложение",
    installHowto:
      "Чтобы установить Neon Forge: открой меню браузера и выбери «Установить приложение» или «На экран Домой».",
    aboutOpen: "Об игре",
    contactLabel: "Связаться с нами",
    aboutClose: "Закрыть",
    aboutIntro:
      "Neon Forge — бесплатный кликер в браузере. Жми по неоновому кубу, лови усиления, переживай ловушки и поднимайся в таблице лидеров.",
    aboutHowTitle: "Как играть",
    aboutHow1: "Кликай по кубу, чтобы набирать очки.",
    aboutHow2: "Следи за эффектами: множители, комбо, лотерея, фото и дебаффы.",
    aboutHow3: "Попадания дают очки, промахи и простой могут снижать счёт.",
    aboutHow4:
      "Случайный ник сохраняет счёт в таблице лидеров. Войди через Google — этот счёт перейдёт на твой аккаунт.",
    aboutHow5: "Язык — в меню: English, Русский, Español, Deutsch, Français.",
    aboutFeaturesTitle: "Возможности",
    aboutFeat1: "Играй сразу, без установки",
    aboutFeat2: "Неоновый cyber-forge стиль",
    aboutFeat3: "Случайные плюсы и минусы",
    aboutFeat4: "Растущее комбо, порядок чисел, лотерея",
    aboutFeat5: "Глобальная таблица лидеров",
    aboutFeat6: "Вход через Google и синхронизация счёта",
    aboutFeat7: "Телефон и компьютер в браузере",
    aboutFeat8: "5 языков",
    aboutEffectsTitle: "Эффекты",
    aboutEffects:
      "Эффекты меняют каждый забег: множители кликов, растущее комбо, кубы по порядку, лотерея с большими качелями, летающие фото, мелкий куб, инверсия кликов и фото-щит. Освой хаос и поднимайся в Neon Forge.",
    aboutWhyTitle: "Зачем играть",
    aboutWhy:
      "Ищешь бесплатный браузерный кликер с настоящей конкуренцией? Neon Forge — короткие напряжённые сессии и погоня за рекордом в таблице лидеров.",
    aboutFaqTitle: "Вопросы",
    aboutFaq1Q: "Neon Forge бесплатный?",
    aboutFaq1A: "Да. Это бесплатный онлайн-кликер: играй в браузере без скачивания и оплаты.",
    aboutFaq2Q: "Нужен аккаунт?",
    aboutFaq2A:
      "Нет. На этом устройстве появляется случайный ник: он сохраняет счёт и показывает его в таблице лидеров. Войди через Google — тот же счёт перейдёт на аккаунт Google.",
    aboutFaq3Q: "Работает на телефоне?",
    aboutFaq3A: "Да. Кликер открывается в мобильном и десктопном браузере.",
    aboutFaq4Q: "Чем отличается от других кликеров?",
    aboutFaq4A:
      "Случайные эффекты по таймеру — множители, комбо, лотерейные кубы и ловушки — плюс живая таблица лидеров.",
    aboutFaq5Q: "Какие языки есть?",
    aboutFaq5A: "Английский, русский, испанский, немецкий и французский.",
    canvasLabel: "Холст кликера",
    leaders: "ЛИДЕРЫ",
    leadersExpand: "Раскрыть лидеров",
    leadersCollapse: "Схлопнуть лидеров",
    resumePause: "Продолжить",
    clicks: "КЛИКИ",
    signInGoogle: "Войти через Google",
    signOut: "Выйти",
    updating: "Обновление…",
    offline: "Офлайн",
    online: "Онлайн",
    emptyLeaders: "Пока пусто — будь первым.",
    player: "Игрок",
    langLabel: "Язык",
    menuTitle: "Меню",
    menuOpen: "Открыть меню",
    menuClose: "Закрыть меню",
    logoutConfirmTitle: "Выйти из аккаунта?",
    logoutConfirmBody: "Счёт останется на этом устройстве и в аккаунте.",
    cancel: "Отмена",
    effectX2: "КЛИК ×{x}",
    effectX3: "КЛИК ×{x}",
    effectFlyingPhoto: "ШЛЁПНИ ФОТКУ ×{x}",
    effectShrinkWander: "КУЛЕНЬКИЙ КУБ",
    effectInvert: "ИНВЕРСИЯ",
    effectCoverPhoto: "ФОТО-ЩИТ",
    effectSplitTwins: "РАЗДВОЕНИЕ",
    effectSplitLottery: "ЛОТЕРЕЯ",
    effectRisingCombo: "КОМБО +{x}",
    effectNumberOrder: "ДАЛЬШЕ {x}",
    tapHint: "Жми на куб",
  },
  es: {
    title: "Neon Forge — clicker gratis en el navegador",
    metaDescription:
      "Juega a Neon Forge gratis en el navegador: clicker neón con potenciadores, combos, lotería y clasificación global. Entra con Google, sin descarga.",
    installApp: "Instalar app",
    installHowto:
      "Para instalar Neon Forge: abre el menú del navegador y elige «Instalar app» o «Añadir a pantalla de inicio».",
    aboutOpen: "Sobre el juego",
    contactLabel: "Contáctanos",
    aboutClose: "Cerrar",
    aboutIntro:
      "Neon Forge es un clicker online gratis que puedes jugar al instante en el navegador. Toca el cubo neón, aprovecha potenciadores, supera trampas y sube en la clasificación global.",
    aboutHowTitle: "Cómo jugar",
    aboutHow1: "Toca o haz clic en el cubo para ganar clics.",
    aboutHow2: "Atento a efectos a tiempo: multiplicadores, combos, lotería, fotos voladoras y trampas.",
    aboutHow3: "Los aciertos suben tu puntuación; los fallos y la inactividad pueden bajarla.",
    aboutHow4:
      "Un apodo aleatorio guarda tu puntuación en la clasificación. Entra con Google para pasar esa puntuación a tu cuenta.",
    aboutHow5: "Cambia el idioma en el menú — English, Русский, Español, Deutsch, Français.",
    aboutFeaturesTitle: "Funciones",
    aboutFeat1: "Juego instantáneo, sin instalar",
    aboutFeat2: "Estilo neon cyber-forge",
    aboutFeat3: "Efectos positivos y negativos aleatorios",
    aboutFeat4: "Combo creciente, orden numérico, lotería partida",
    aboutFeat5: "Clasificación global (mejores jugadores)",
    aboutFeat6: "Inicio con Google y sincronización en la nube",
    aboutFeat7: "Compatible con móvil y escritorio",
    aboutFeat8: "5 idiomas incluidos",
    aboutEffectsTitle: "Efectos",
    aboutEffects:
      "Los efectos cambian cada partida: multiplicadores, combos, cubos en orden, lotería gemela con grandes altibajos, fotos voladoras, cubo pequeño, clics invertidos y escudos de foto. Domina el caos y escala en Neon Forge.",
    aboutWhyTitle: "Por qué jugar",
    aboutWhy:
      "¿Buscas un clicker gratis en el navegador con competencia real? Neon Forge ofrece sesiones cortas, tensas y fáciles de compartir — ideal para un récord rápido o una carrera larga en la clasificación.",
    aboutFaqTitle: "Preguntas",
    aboutFaq1Q: "¿Neon Forge es gratis?",
    aboutFaq1A: "Sí. Neon Forge es un clicker online gratis: juega en el navegador sin descarga ni pago.",
    aboutFaq2Q: "¿Necesito una cuenta?",
    aboutFaq2A:
      "No. Este dispositivo recibe un apodo aleatorio que guarda tu puntuación y la muestra en la clasificación. Entra con Google para pasar esa puntuación a tu cuenta de Google.",
    aboutFaq3Q: "¿Funciona en el móvil?",
    aboutFaq3A: "Sí. Funciona en navegadores móviles y de escritorio como clicker web ligero.",
    aboutFaq4Q: "¿En qué se diferencia de otros clickers?",
    aboutFaq4A:
      "Efectos caóticos a tiempo — multiplicadores, combos, lotería gemela y trampas — más una tabla de líderes en vivo.",
    aboutFaq5Q: "¿Qué idiomas hay?",
    aboutFaq5A: "Inglés, ruso, español, alemán y francés.",
    canvasLabel: "Lienzo del clicker",
    leaders: "LÍDERES",
    leadersExpand: "Abrir líderes",
    leadersCollapse: "Cerrar líderes",
    resumePause: "Continuar",
    clicks: "CLICS",
    signInGoogle: "Entrar con Google",
    signOut: "Salir",
    updating: "Actualizando…",
    offline: "Sin conexión",
    online: "En línea",
    emptyLeaders: "Aún no hay puntuaciones — sé el primero.",
    player: "Jugador",
    langLabel: "Idioma",
    menuTitle: "Menú",
    menuOpen: "Abrir menú",
    menuClose: "Cerrar menú",
    logoutConfirmTitle: "¿Cerrar sesión?",
    logoutConfirmBody: "Tu puntuación se queda en este dispositivo y en tu cuenta.",
    cancel: "Cancelar",
    effectX2: "CLIC ×{x}",
    effectX3: "CLIC ×{x}",
    effectFlyingPhoto: "DALE A LA FOTO ×{x}",
    effectShrinkWander: "CUBO MÓVIL",
    effectInvert: "CLICS INVERTIDOS",
    effectCoverPhoto: "FOTO CUBRE",
    effectSplitTwins: "CUBO PARTIDO",
    effectSplitLottery: "LOTERÍA",
    effectRisingCombo: "COMBO +{x}",
    effectNumberOrder: "SIGUE {x}",
    tapHint: "Toca el cubo",
  },
  de: {
    title: "Neon Forge — kostenloser Browser-Clicker",
    metaDescription:
      "Neon Forge kostenlos im Browser spielen: Neon-Clicker mit Power-ups, Combos, Lotterie und globaler Bestenliste. Mit Google anmelden, kein Download.",
    installApp: "App installieren",
    installHowto:
      "So installierst du Neon Forge: öffne das Browser-Menü und wähle „App installieren“ oder „Zum Home-Bildschirm“.",
    aboutOpen: "Über das Spiel",
    contactLabel: "Kontakt",
    aboutClose: "Schließen",
    aboutIntro:
      "Neon Forge ist ein kostenloser Online-Clicker zum sofortigen Spielen im Browser. Tippe den Neon-Würfel, nutze Power-ups, überstehe Debuffs und klettere in der globalen Bestenliste.",
    aboutHowTitle: "So spielst du",
    aboutHow1: "Tippe oder klicke den Würfel, um Klicks zu verdienen.",
    aboutHow2: "Achte auf zeitlich begrenzte Effekte: Multiplikatoren, Combos, Lotterie, fliegende Fotos und Fallen.",
    aboutHow3: "Treffer erhöhen den Score; Fehlklicks und Stillstand können ihn senken.",
    aboutHow4:
      "Ein Zufallsname speichert deinen Score in der Bestenliste. Mit Google anmelden, um den Score auf dein Konto zu übernehmen.",
    aboutHow5: "Sprache im Menü wechseln — English, Русский, Español, Deutsch, Français.",
    aboutFeaturesTitle: "Features",
    aboutFeat1: "Sofort spielen, keine Installation",
    aboutFeat2: "Neon Cyber-Forge Look",
    aboutFeat3: "Zufällige positive und negative Effekte",
    aboutFeat4: "Steigendes Combo, Zahlenreihenfolge, Split-Lotterie",
    aboutFeat5: "Globale Bestenliste (Top-Spieler)",
    aboutFeat6: "Google-Login und Score-Sync in der Cloud",
    aboutFeat7: "Handy und Desktop im Browser",
    aboutFeat8: "5 Sprachen integriert",
    aboutEffectsTitle: "Effekte",
    aboutEffects:
      "Effekte würfeln jede Runde um: Klick-Multiplikatoren, steigende Combos, nummerierte Würfel in Reihenfolge, Zwillingslotterie mit großen Ausschlägen, fliegende Fotos, schrumpfender Würfel, invertierte Klicks und Foto-Schilde. Beherrsche das Chaos und steige in Neon Forge auf.",
    aboutWhyTitle: "Warum spielen",
    aboutWhy:
      "Suchst du einen kostenlosen Browser-Clicker mit echter Konkurrenz? Neon Forge hält Sessions kurz, spannend und teilbar — ideal für einen schnellen Highscore oder einen längeren Grind gegen die Bestenliste.",
    aboutFaqTitle: "FAQ",
    aboutFaq1Q: "Ist Neon Forge kostenlos?",
    aboutFaq1A: "Ja. Neon Forge ist ein kostenloser Online-Clicker — im Browser spielen, ohne Download oder Zahlung.",
    aboutFaq2Q: "Brauche ich ein Konto?",
    aboutFaq2A:
      "Nein. Dieses Gerät bekommt einen Zufallsnamen, der den Score speichert und in der Bestenliste zeigt. Mit Google anmelden, um denselben Score auf dein Google-Konto zu übernehmen.",
    aboutFaq3Q: "Funktioniert Neon Forge auf dem Handy?",
    aboutFaq3A: "Ja. Es läuft in mobilen und Desktop-Browsern als leichter Web-Clicker.",
    aboutFaq4Q: "Was unterscheidet Neon Forge von anderen Clickern?",
    aboutFaq4A:
      "Zeitlich begrenzte chaotische Effekte — Multiplikatoren, Combos, Lotterie-Zwillinge und Fallen — plus eine live Bestenliste.",
    aboutFaq5Q: "Welche Sprachen gibt es?",
    aboutFaq5A: "Englisch, Russisch, Spanisch, Deutsch und Französisch.",
    canvasLabel: "Clicker-Leinwand",
    leaders: "BESTENLISTE",
    leadersExpand: "Bestenliste öffnen",
    leadersCollapse: "Bestenliste schließen",
    resumePause: "Fortsetzen",
    clicks: "KLICKS",
    signInGoogle: "Mit Google anmelden",
    signOut: "Abmelden",
    updating: "Aktualisiere…",
    offline: "Offline",
    online: "Online",
    emptyLeaders: "Noch keine Punkte — sei der Erste.",
    player: "Spieler",
    langLabel: "Sprache",
    menuTitle: "Menü",
    menuOpen: "Menü öffnen",
    menuClose: "Menü schließen",
    logoutConfirmTitle: "Abmelden?",
    logoutConfirmBody: "Dein Punktestand bleibt auf diesem Gerät und in deinem Konto.",
    cancel: "Abbrechen",
    effectX2: "KLICK ×{x}",
    effectX3: "KLICK ×{x}",
    effectFlyingPhoto: "HAU AUFS FOTO ×{x}",
    effectShrinkWander: "KLEINER WÜRFEL",
    effectInvert: "INVERTIERTE KLICKS",
    effectCoverPhoto: "FOTO-SCHILD",
    effectSplitTwins: "GETEILTER WÜRFEL",
    effectSplitLottery: "LOTTERIE",
    effectRisingCombo: "KOMBO +{x}",
    effectNumberOrder: "NÄCHSTE {x}",
    tapHint: "Würfel tippen",
  },
  fr: {
    title: "Neon Forge — clicker gratuit dans le navigateur",
    metaDescription:
      "Jouez à Neon Forge gratuitement dans le navigateur : clicker néon, bonus chaotiques, combos, loterie et classement mondial. Connexion Google, sans téléchargement.",
    installApp: "Installer l’app",
    installHowto:
      "Pour installer Neon Forge : ouvrez le menu du navigateur et choisissez « Installer l’application » ou « Sur l’écran d’accueil ».",
    aboutOpen: "À propos",
    contactLabel: "Nous contacter",
    aboutClose: "Fermer",
    aboutIntro:
      "Neon Forge est un clicker en ligne gratuit à jouer immédiatement dans le navigateur. Tapez le cube néon, enchaînez les bonus, survivez aux pièges et grimpez au classement mondial.",
    aboutHowTitle: "Comment jouer",
    aboutHow1: "Touchez ou cliquez sur le cube pour gagner des clics.",
    aboutHow2: "Surveillez les effets temporisés : multiplicateurs, combos, loterie, photos volantes et pièges.",
    aboutHow3: "Les touches font monter le score ; les ratés et l’inactivité peuvent le faire baisser.",
    aboutHow4:
      "Un pseudo aléatoire enregistre le score au classement. Connectez-vous avec Google pour transférer ce score sur votre compte.",
    aboutHow5: "Changez de langue dans le menu — English, Русский, Español, Deutsch, Français.",
    aboutFeaturesTitle: "Fonctionnalités",
    aboutFeat1: "Jeu instantané, sans installation",
    aboutFeat2: "Style neon cyber-forge",
    aboutFeat3: "Effets positifs et négatifs aléatoires",
    aboutFeat4: "Combo croissant, ordre des chiffres, loterie double",
    aboutFeat5: "Classement mondial (meilleurs joueurs)",
    aboutFeat6: "Connexion Google et sync du score dans le cloud",
    aboutFeat7: "Mobile et ordinateur dans le navigateur",
    aboutFeat8: "5 langues intégrées",
    aboutEffectsTitle: "Effets",
    aboutEffects:
      "Les effets bouleversent chaque partie : multiplicateurs de clics, combos croissants, cubes numérotés dans l’ordre, loterie jumelle à gros écarts, photos volantes, cube réduit, clics inversés et boucliers photo. Maîtrisez le chaos et grimpez dans Neon Forge.",
    aboutWhyTitle: "Pourquoi jouer",
    aboutWhy:
      "Vous cherchez un clicker gratuit dans le navigateur avec une vraie compétition ? Neon Forge propose des sessions courtes, tendues et partageables — parfait pour un record rapide ou une longue course au classement.",
    aboutFaqTitle: "FAQ",
    aboutFaq1Q: "Neon Forge est-il gratuit ?",
    aboutFaq1A: "Oui. Neon Forge est un clicker en ligne gratuit — jouez dans le navigateur sans téléchargement ni paiement.",
    aboutFaq2Q: "Faut-il un compte ?",
    aboutFaq2A:
      "Non. Cet appareil reçoit un pseudo aléatoire qui enregistre le score et l’affiche au classement. Connectez-vous avec Google pour transférer ce score sur votre compte Google.",
    aboutFaq3Q: "Ça marche sur téléphone ?",
    aboutFaq3A: "Oui. Ça fonctionne dans les navigateurs mobiles et desktop comme clicker web léger.",
    aboutFaq4Q: "Qu’est-ce qui le distingue des autres clickers ?",
    aboutFaq4A:
      "Des effets chaotiques temporisés — multiplicateurs, combos, loterie jumelle et pièges — plus un classement en direct.",
    aboutFaq5Q: "Quelles langues sont prises en charge ?",
    aboutFaq5A: "Anglais, russe, espagnol, allemand et français.",
    canvasLabel: "Toile du clicker",
    leaders: "CLASSEMENT",
    leadersExpand: "Ouvrir le classement",
    leadersCollapse: "Réduire le classement",
    resumePause: "Reprendre",
    clicks: "CLICS",
    signInGoogle: "Connexion Google",
    signOut: "Déconnexion",
    updating: "Mise à jour…",
    offline: "Hors ligne",
    online: "En ligne",
    emptyLeaders: "Pas encore de scores — soyez le premier.",
    player: "Joueur",
    langLabel: "Langue",
    menuTitle: "Menu",
    menuOpen: "Ouvrir le menu",
    menuClose: "Fermer le menu",
    logoutConfirmTitle: "Se déconnecter ?",
    logoutConfirmBody: "Votre score reste sur cet appareil et dans votre compte.",
    cancel: "Annuler",
    effectX2: "CLIC ×{x}",
    effectX3: "CLIC ×{x}",
    effectFlyingPhoto: "TAPE LA PHOTO ×{x}",
    effectShrinkWander: "CUBE MINI",
    effectInvert: "CLICS INVERSÉS",
    effectCoverPhoto: "PHOTO BOUCLIER",
    effectSplitTwins: "CUBE SCINDÉ",
    effectSplitLottery: "LOTERIE",
    effectRisingCombo: "COMBO +{x}",
    effectNumberOrder: "SUIVANT {x}",
    tapHint: "Touche le cube",
  },
};

/** @type {readonly Locale[]} */
export const LOCALES = Object.freeze(["en", "ru", "es", "de", "fr"]);

/** @type {Record<Locale, string>} */
const OG_LOCALE = {
  en: "en_US",
  ru: "ru_RU",
  es: "es_ES",
  de: "de_DE",
  fr: "fr_FR",
};

/** @type {Locale} */
let current = "en";

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * @param {string} raw
 * @returns {Locale | null}
 */
function normalize(raw) {
  const base = String(raw || "")
    .trim()
    .toLowerCase()
    .replace("_", "-")
    .slice(0, 2);
  return LOCALES.includes(/** @type {Locale} */ (base))
    ? /** @type {Locale} */ (base)
    : null;
}

/**
 * @returns {Locale}
 */
export function detectSystemLocale() {
  const nav =
    typeof navigator !== "undefined"
      ? [...(navigator.languages || []), navigator.language].filter(Boolean)
      : [];
  for (const code of nav) {
    const hit = normalize(code);
    if (hit) return hit;
  }
  return "en";
}

/**
 * @returns {Locale}
 */
function resolveInitialLocale() {
  try {
    if (localStorage.getItem(MANUAL_KEY) === "1") {
      const saved = normalize(localStorage.getItem(STORAGE_KEY) || "");
      if (saved) return saved;
    }
  } catch {
    // ignore
  }
  return detectSystemLocale();
}

/**
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 * @returns {string}
 */
export function t(key, vars) {
  let text = MESSAGES[current][key] || MESSAGES.en[key] || key;
  if (!vars) return text;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

/** @returns {Locale} */
export function getLocale() {
  return current;
}

/**
 * @param {Locale} locale
 * @param {{ manual?: boolean }} [opts]
 */
export function setLocale(locale, opts = {}) {
  const next = normalize(locale) || "en";
  const manual = opts.manual !== false;
  const changed = next !== current;
  current = next;

  try {
    localStorage.setItem(STORAGE_KEY, current);
    if (manual) localStorage.setItem(MANUAL_KEY, "1");
  } catch {
    // ignore
  }

  applyDom();
  if (changed) {
    for (const fn of listeners) fn();
  }
}

/**
 * @param {() => void} fn
 * @returns {() => void}
 */
export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * @param {string} selector
 * @param {string} value
 */
function setMeta(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute("content", value);
}

function applyDom() {
  document.documentElement.lang = current;
  document.title = t("title");
  const description = t("metaDescription");
  setMeta('meta[name="description"]', description);
  setMeta('meta[property="og:title"]', document.title);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[property="og:locale"]', OG_LOCALE[current]);
  setMeta('meta[name="twitter:title"]', document.title);
  setMeta('meta[name="twitter:description"]', description);

  for (const el of document.querySelectorAll("[data-i18n]")) {
    const key = el.getAttribute("data-i18n");
    if (!key) continue;
    el.textContent = t(key);
  }

  for (const el of document.querySelectorAll("[data-i18n-aria]")) {
    const key = el.getAttribute("data-i18n-aria");
    if (!key) continue;
    el.setAttribute("aria-label", t(key));
  }

  const list = document.getElementById("locale-list");
  if (!list) return;
  for (const btn of list.querySelectorAll("[data-locale]")) {
    const code = btn.getAttribute("data-locale");
    const active = code === current;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  }
}

/**
 * @param {HTMLElement} listEl
 */
export function initI18n(listEl) {
  current = resolveInitialLocale();

  listEl.innerHTML = "";
  for (const code of LOCALES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu__lang";
    btn.setAttribute("role", "option");
    btn.setAttribute("data-locale", code);
    btn.textContent = LOCALE_LABELS[code];
    btn.addEventListener("click", () => {
      setLocale(code, { manual: true });
    });
    listEl.appendChild(btn);
  }

  applyDom();
}
