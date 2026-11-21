import type { ClassDef, SkillCardDef, SummonDef } from "@pyrocardian/shared";

export type UILang = "zh" | "en";

const messages: Record<UILang, Record<string, string>> = {
  zh: {
    "app.tagline": "翻开你的第一张卡，进入卡牌世界。",
    "login.email": "邮箱",
    "login.password": "密码（至少 6 位）",
    "login.submitLogin": "进入世界",
    "login.submitRegister": "注册并进入世界",
    "login.switchToRegister": "没有账号？注册新角色",
    "login.switchToLogin": "已有账号？登录",
    "town.title": "卡迪安小镇广场",
    "town.logout": "离开世界",
    "town.lang": "EN",
    "town.collection": "收藏馆",
    "town.library": "图书馆",
    "town.arena": "竞技场",
    "town.portal": "传送门",
    "town.forge": "熔炉",
    "town.arenaPlaceholder": "竞技场施工中：PvE 关卡与好友房即将到来。",
    "town.forgePlaceholder": "熔炉施工中：分解/合成（学者专属）即将到来。",
    "collection.characters": "角色卡",
    "collection.skills": "技能卡",
    "collection.words": "单词卡",
    "collection.combat": "可参战",
    "collection.functional": "功能职业",
    "library.title": "图书馆 · 今日待复习 {n} 张",
    "library.show": "显示释义",
    "library.hide": "隐藏释义",
    "library.remember": "认识",
    "library.forgot": "不认识",
    "library.empty": "今天没有待复习的单词卡，去广场逛逛吧。",
    "word.de": "德语",
    "word.en": "英语",
    "error.auth.invalid_input": "邮箱无效，或密码少于 6 位",
    "error.auth.email_taken": "该邮箱已注册",
    "error.auth.invalid_credentials": "邮箱或密码错误",
    "error.auth.unauthorized": "未登录或登录已过期",
    "error.words.unknown_card": "未知单词卡",
    "error.http_error": "请求失败，请稍后再试",
    "error.unknown": "出错了",
    "battle.title": "竞技场 · 好友房",
    "battle.choose": "选择一张可参战的角色卡出战：",
    "battle.create": "创建房间",
    "battle.quick": "快速匹配",
    "battle.join": "加入房间",
    "battle.roomCode": "房间号",
    "battle.roomHint": "把房间号发给朋友",
    "battle.needCharacter": "请先选择一张角色卡",
    "battle.needRoom": "请输入房间号",
    "battle.leave": "离开房间",
    "battle.you": "你",
    "battle.opponent": "对手",
    "battle.hp": "生命",
    "battle.mana": "法力",
    "battle.shield": "护盾",
    "battle.deck": "牌库",
    "battle.summons": "召唤物",
    "battle.hand": "手牌",
    "battle.log": "战斗日志",
    "battle.play": "打出",
    "battle.attack": "普攻",
    "battle.endTurn": "结束回合",
    "battle.myTurn": "你的回合",
    "battle.opponentTurn": "对手的回合",
    "battle.win": "你赢了！",
    "battle.lose": "你输了",
    "battle.empty": "手牌为空",
    "battle.pve": "PvE · 单挑 boss",
    "portal.title": "传送门 · PvE 挑战",
    "portal.bosses": "选择一个 boss 挑战：",
    "portal.recruit": "招募同伴（3 选 1）",
    "portal.offers": "选择你的同伴，然后出战：",
    "portal.wallet": "魔晶石",
    "portal.level": "访客 Lv.{n}",
    "portal.xp": "经验 {xp}",
    "portal.affinityPoints": "可用亲和点：{n}",
    "portal.affinity": "亲和力",
    "portal.noBoss": "请先选择一个 boss",
    "library.ancient": "古老的卡牌（未鉴定）",
    "library.identify": "鉴定",
    "library.identified": "鉴定结果：{name}",
    "library.noAncient": "暂无古老的卡牌，去传送门挑战 boss 吧",
    "elem.fire": "火",
    "elem.water": "水",
    "elem.thunder": "雷",
    "elem.ice": "冰",
    "elem.earth": "土",
    "error.cards.not_ancient": "该卡不是古老的卡牌",
    "error.visitor.bad_element": "未知的元素",
    "error.visitor.no_points": "没有可用的亲和点",
  },
  en: {
    "app.tagline": "Open your first card and enter the Cardian world.",
    "login.email": "Email",
    "login.password": "Password (min 6 chars)",
    "login.submitLogin": "Enter the world",
    "login.submitRegister": "Register & enter the world",
    "login.switchToRegister": "No account? Register",
    "login.switchToLogin": "Have an account? Log in",
    "town.title": "Cardian Town Square",
    "town.logout": "Leave the world",
    "town.lang": "中文",
    "town.collection": "Collection",
    "town.library": "Library",
    "town.arena": "Arena",
    "town.portal": "Portal",
    "town.forge": "Forge",
    "town.arenaPlaceholder": "Arena under construction: PvE stages and friend rooms are coming soon.",
    "town.forgePlaceholder": "Forge under construction: decompose/synthesize (scholar only) is coming soon.",
    "collection.characters": "Character Cards",
    "collection.skills": "Skill Cards",
    "collection.words": "Word Cards",
    "collection.combat": "combat-ready",
    "collection.functional": "functional class",
    "library.title": "Library · {n} word cards due today",
    "library.show": "Show translation",
    "library.hide": "Hide translation",
    "library.remember": "Know it",
    "library.forgot": "Forgot",
    "library.empty": "No word cards due today. Enjoy the town square!",
    "word.de": "German",
    "word.en": "English",
    "error.auth.invalid_input": "Invalid email, or password shorter than 6 characters",
    "error.auth.email_taken": "This email is already registered",
    "error.auth.invalid_credentials": "Wrong email or password",
    "error.auth.unauthorized": "Not logged in or session expired",
    "error.words.unknown_card": "Unknown word card",
    "error.http_error": "Request failed, please try again",
    "error.unknown": "Something went wrong",
    "battle.title": "Arena · Friend Room",
    "battle.choose": "Pick a combat-ready character card to fight with:",
    "battle.create": "Create room",
    "battle.quick": "Quick match",
    "battle.join": "Join room",
    "battle.roomCode": "Room code",
    "battle.roomHint": "send the room code to a friend",
    "battle.needCharacter": "Please pick a character card first",
    "battle.needRoom": "Please enter a room code",
    "battle.leave": "Leave room",
    "battle.you": "You",
    "battle.opponent": "Opponent",
    "battle.hp": "HP",
    "battle.mana": "Mana",
    "battle.shield": "Shield",
    "battle.deck": "Deck",
    "battle.summons": "Summons",
    "battle.hand": "Hand",
    "battle.log": "Battle log",
    "battle.play": "Play",
    "battle.attack": "Attack",
    "battle.endTurn": "End turn",
    "battle.myTurn": "Your turn",
    "battle.opponentTurn": "Opponent's turn",
    "battle.win": "You won!",
    "battle.lose": "You lost",
    "battle.empty": "Hand is empty",
    "battle.pve": "PvE · boss fight",
    "portal.title": "Portal · PvE Challenge",
    "portal.bosses": "Pick a boss to challenge:",
    "portal.recruit": "Recruit a companion (pick 1 of 3)",
    "portal.offers": "Choose your companion to fight:",
    "portal.wallet": "Magic Stones",
    "portal.level": "Visitor Lv.{n}",
    "portal.xp": "XP {xp}",
    "portal.affinityPoints": "Affinity points: {n}",
    "portal.affinity": "Affinity",
    "portal.noBoss": "Please pick a boss first",
    "library.ancient": "Ancient Cards (unappraised)",
    "library.identify": "Appraise",
    "library.identified": "Appraisal result: {name}",
    "library.noAncient": "No ancient cards yet — challenge a boss at the Portal!",
    "elem.fire": "Fire",
    "elem.water": "Water",
    "elem.thunder": "Thunder",
    "elem.ice": "Ice",
    "elem.earth": "Earth",
    "error.cards.not_ancient": "This is not an ancient card",
    "error.visitor.bad_element": "Unknown element",
    "error.visitor.no_points": "No affinity points available",
  },
};

export type T = (key: string, vars?: Record<string, string | number>) => string;

export function makeT(lang: UILang): T {
  return (key, vars) => {
    let s = messages[lang][key] ?? messages.zh[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replaceAll(`{${k}}`, String(v));
      }
    }
    return s;
  };
}

export function detectLang(): UILang {
  const saved = localStorage.getItem("pyrocardian_lang");
  if (saved === "en" || saved === "zh") return saved;
  return navigator.language.toLowerCase().startsWith("en") ? "en" : "zh";
}

export function localizeClassName(cls: ClassDef, lang: UILang): string {
  return lang === "en" ? (cls.nameEn ?? cls.name) : cls.name;
}

export function localizeSkillName(def: SkillCardDef, lang: UILang): string {
  return lang === "en" ? (def.nameEn ?? def.name) : def.name;
}

export function localizeSkillText(def: SkillCardDef, lang: UILang): string {
  return lang === "en" ? (def.textEn ?? def.text) : def.text;
}

export function localizeSummonText(def: SummonDef, lang: UILang): string {
  return lang === "en" ? (def.textEn ?? def.text) : def.text;
}
