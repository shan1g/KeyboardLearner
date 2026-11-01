export interface Pic {
  emoji: string;
  word: string;
}

// Emojis are limited to Unicode 12 or lower so they render on Windows 10, older iPads and Chromebooks.
const RAW: Record<string, [emoji: string, word: string][]> = {
  A: [['🍎', 'Apple'], ['🐜', 'Ant'], ['🐊', 'Alligator'], ['✈️', 'Airplane'], ['🥑', 'Avocado'], ['👽', 'Alien'], ['🚑', 'Ambulance'], ['⚓', 'Anchor']],
  B: [['🐻', 'Bear'], ['🐝', 'Bee'], ['🎈', 'Balloon'], ['🍌', 'Banana'], ['🦋', 'Butterfly'], ['⚽', 'Ball'], ['🚌', 'Bus'], ['🐦', 'Bird'], ['🍞', 'Bread']],
  C: [['🐱', 'Cat'], ['🍰', 'Cake'], ['🚗', 'Car'], ['🐄', 'Cow'], ['🥕', 'Carrot'], ['🍪', 'Cookie'], ['🦀', 'Crab'], ['🧀', 'Cheese'], ['🌵', 'Cactus']],
  D: [['🐶', 'Dog'], ['🍩', 'Donut'], ['🥁', 'Drum'], ['🦆', 'Duck'], ['🐬', 'Dolphin'], ['🦕', 'Dinosaur'], ['🐉', 'Dragon'], ['🚪', 'Door']],
  E: [['🐘', 'Elephant'], ['🥚', 'Egg'], ['🦅', 'Eagle'], ['👁️', 'Eye'], ['🌍', 'Earth'], ['🍆', 'Eggplant'], ['✉️', 'Envelope'], ['🧝', 'Elf']],
  F: [['🐟', 'Fish'], ['🐸', 'Frog'], ['🦊', 'Fox'], ['🍟', 'Fries'], ['🌸', 'Flower'], ['🔥', 'Fire'], ['🚒', 'Fire truck'], ['🧚', 'Fairy'], ['🦩', 'Flamingo']],
  G: [['🦒', 'Giraffe'], ['🍇', 'Grapes'], ['🎸', 'Guitar'], ['🐐', 'Goat'], ['🦍', 'Gorilla'], ['🎁', 'Gift'], ['👻', 'Ghost'], ['👓', 'Glasses']],
  H: [['🏠', 'House'], ['🎩', 'Hat'], ['🐴', 'Horse'], ['🍔', 'Hamburger'], ['🚁', 'Helicopter'], ['❤️', 'Heart'], ['🦔', 'Hedgehog'], ['🍯', 'Honey']],
  I: [['🍦', 'Ice cream'], ['🦎', 'Iguana'], ['🧊', 'Ice'], ['🏝️', 'Island'], ['💡', 'Idea'], ['🐛', 'Insect'], ['♾️', 'Infinity']],
  J: [['🧃', 'Juice'], ['🕹️', 'Joystick'], ['🐆', 'Jaguar'], ['🤹', 'Juggler'], ['👖', 'Jeans'], ['🧥', 'Jacket'], ['💎', 'Jewel'], ['🧩', 'Jigsaw'], ['🛩️', 'Jet']],
  K: [['🔑', 'Key'], ['🐨', 'Koala'], ['🦘', 'Kangaroo'], ['🥝', 'Kiwi'], ['🐈', 'Kitten'], ['🪁', 'Kite'], ['⌨️', 'Keyboard'], ['🥋', 'Karate']],
  L: [['🦁', 'Lion'], ['🍋', 'Lemon'], ['🍭', 'Lollipop'], ['🐞', 'Ladybug'], ['🍃', 'Leaf'], ['🦙', 'Llama'], ['🦞', 'Lobster'], ['🔒', 'Lock']],
  M: [['🐒', 'Monkey'], ['🌙', 'Moon'], ['🐭', 'Mouse'], ['🍄', 'Mushroom'], ['🥭', 'Mango'], ['🧲', 'Magnet'], ['🍈', 'Melon'], ['🏍️', 'Motorbike'], ['🧁', 'Muffin']],
  N: [['👃', 'Nose'], ['🥜', 'Nuts'], ['🍜', 'Noodles'], ['🎶', 'Notes'], ['🌃', 'Night'], ['📰', 'Newspaper'], ['🔢', 'Numbers']],
  O: [['🐙', 'Octopus'], ['🍊', 'Orange'], ['🦉', 'Owl'], ['🦦', 'Otter'], ['🧅', 'Onion'], ['🦪', 'Oyster'], ['🦧', 'Orangutan'], ['🌊', 'Ocean']],
  P: [['🐼', 'Panda'], ['🍕', 'Pizza'], ['🐧', 'Penguin'], ['🐷', 'Pig'], ['🍐', 'Pear'], ['🍍', 'Pineapple'], ['🦜', 'Parrot'], ['🎃', 'Pumpkin'], ['✏️', 'Pencil'], ['🍿', 'Popcorn']],
  Q: [['👑', 'Queen'], ['❓', 'Question'], ['🦆', 'Quack'], ['🤫', 'Quiet'], ['🏃', 'Quick']],
  R: [['🤖', 'Robot'], ['🚀', 'Rocket'], ['🌈', 'Rainbow'], ['🐰', 'Rabbit'], ['🦏', 'Rhino'], ['🌹', 'Rose'], ['💍', 'Ring'], ['🦝', 'Raccoon']],
  S: [['🍓', 'Strawberry'], ['🐍', 'Snake'], ['☀️', 'Sun'], ['⭐', 'Star'], ['🦈', 'Shark'], ['🐌', 'Snail'], ['⛄', 'Snowman'], ['🧦', 'Socks'], ['🕷️', 'Spider'], ['🛹', 'Skateboard']],
  T: [['🐯', 'Tiger'], ['🌮', 'Taco'], ['🚂', 'Train'], ['🐢', 'Turtle'], ['🌳', 'Tree'], ['🍅', 'Tomato'], ['🧸', 'Teddy bear'], ['🎺', 'Trumpet'], ['🚜', 'Tractor']],
  U: [['🦄', 'Unicorn'], ['☂️', 'Umbrella'], ['🛸', 'UFO'], ['⬆️', 'Up'], ['🙃', 'Upside down']],
  V: [['🎻', 'Violin'], ['🌋', 'Volcano'], ['🚐', 'Van'], ['🥦', 'Vegetables'], ['🏐', 'Volleyball'], ['🎮', 'Video game'], ['✌️', 'Victory'], ['💜', 'Violet']],
  W: [['🐳', 'Whale'], ['🍉', 'Watermelon'], ['⌚', 'Watch'], ['🐺', 'Wolf'], ['🧙', 'Wizard'], ['🌬️', 'Wind'], ['👋', 'Wave'], ['🕸️', 'Web']],
  X: [['🦴', 'X-ray'], ['🎄', 'Xmas tree'], ['❌', 'X mark'], ['🐠', 'X-ray fish']],
  Y: [['🪀', 'Yo-yo'], ['🧶', 'Yarn'], ['⛵', 'Yacht'], ['🍠', 'Yam'], ['💛', 'Yellow'], ['🧘', 'Yoga'], ['😋', 'Yummy'], ['🥱', 'Yawn']],
  Z: [['🦓', 'Zebra'], ['⚡', 'Zap'], ['💤', 'Zzz'], ['🤐', 'Zip'], ['0️⃣', 'Zero'], ['🏎️', 'Zoom']],
  '0': [['0️⃣', 'Zero']],
  '1': [['1️⃣', 'One']],
  '2': [['2️⃣', 'Two']],
  '3': [['3️⃣', 'Three']],
  '4': [['4️⃣', 'Four']],
  '5': [['5️⃣', 'Five']],
  '6': [['6️⃣', 'Six']],
  '7': [['7️⃣', 'Seven']],
  '8': [['8️⃣', 'Eight']],
  '9': [['9️⃣', 'Nine']],
  ' ': [['🚀', 'Space'], ['🛸', 'Space'], ['🌌', 'Space'], ['🛰️', 'Space'], ['🪐', 'Space'], ['🌠', 'Space'], ['🌕', 'Space']],
};

export const KEY_MAP: Record<string, Pic[]> = Object.fromEntries(
  Object.entries(RAW).map(([key, list]) => [key, list.map(([emoji, word]) => ({ emoji, word }))]),
);

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const NOTE_ORDER = [...LETTERS, ...'0123456789'.split(''), ' '];
/** Stable index per key, used to give every key its own musical note. */
export const noteIndex = (key: string) => Math.max(0, NOTE_ORDER.indexOf(key));

export const randomItem = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** Maps a keyboard event to a supported key ("A"-"Z", "0"-"9" or " "), or null. */
export function keyFromEvent(e: KeyboardEvent): string | null {
  if (e.key === ' ' || e.code === 'Space') return ' ';
  if (e.key.length === 1) {
    const key = e.key.toUpperCase();
    if (KEY_MAP[key]) return key;
  }
  // Fallback for Shift+digit, Ctrl+letter etc. where e.key is a symbol.
  const m = /^(?:Key([A-Z])|Digit(\d)|Numpad(\d))$/.exec(e.code);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}
