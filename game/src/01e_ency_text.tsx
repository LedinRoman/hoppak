/* Encyclopedia card descriptions.
   This is the table to edit: placeholder copy for now.
   Roman will replace each line with lore and a short joke.
   Heroes are keyed by CHARS id, mobs by kind, maps by MAPS id.
   HUD font S wraps these lines; it never shrinks the type. Keep them short. */
var ENCY_BLURB: any = {
  ru: {
    hero: {
      pilot: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      pirate: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      ninja: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      robot: "ВКЛЮЧАЕТ ЩИТ, КАК БОНУС.",
      mage: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      knight: "ПИКЕ ЩИТОМ ВНИЗ. ДО ДВУХ ЗАРЯДОВ. С ПЛАТФОРМЫ — СУПЕРПРЫЖОК."
    },
    mob: {
      blob: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      trash: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      bat: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      hole: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      ufo: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      frog: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      parrot: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      snake: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      monkey: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА."
    },
    map: {
      city: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      jungle: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      ice: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      lava: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      aqua: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА.",
      space: "ПОКА ЗАГЛУШКА. ЗДЕСЬ БУДЕТ ИСТОРИЯ И ШУТКА."
    }
  },
  en: {
    hero: {
      pilot: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      pirate: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      ninja: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      robot: "TURNS ON THE SHIELD, SAME AS THE BONUS.",
      mage: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      knight: "DIVE WITH THE SHIELD. UP TO TWO CHARGES. SUPER JUMP FROM A PLATFORM."
    },
    mob: {
      blob: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      trash: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      bat: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      hole: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      ufo: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      frog: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      parrot: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      snake: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      monkey: "PLACEHOLDER. LORE AND A JOKE GO HERE."
    },
    map: {
      city: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      jungle: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      ice: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      lava: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      aqua: "PLACEHOLDER. LORE AND A JOKE GO HERE.",
      space: "PLACEHOLDER. LORE AND A JOKE GO HERE."
    }
  }
};
function encyBlurbText(kind: string, id: string): string {
  var lang = (typeof gameLanguage === "function") ? gameLanguage() : "ru";
  var pack = ENCY_BLURB[lang] || ENCY_BLURB.ru;
  var group = pack && pack[kind];
  return (group && group[id]) || "";
}
