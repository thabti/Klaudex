import { memo, useState, useEffect, useMemo, useCallback } from 'react'
import { IconSearch, IconRefresh, IconPhoto, IconChevronDown } from '@tabler/icons-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FRAMEWORK_ICONS } from '@/lib/framework-icons'
import { fuzzyScore } from '@/lib/fuzzy-search'
import { ipc } from '@/lib/ipc'

type IconOverride =
  | { type: 'framework'; id: string }
  | { type: 'file'; path: string }
  | { type: 'emoji'; emoji: string }

interface IconPickerDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly cwd: string
  readonly onSelect: (override: IconOverride) => void
  readonly onReset: () => void
}

const MAX_IMAGE_SIZE_PX = 0

const FRAMEWORK_IDS = [
  'nextjs', 'react', 'vue', 'svelte', 'angular',
  'rust', 'go', 'python', 'ruby', 'java',
  'typescript', 'javascript', 'php', 'cpp', 'docker',
] as const

const FRAMEWORK_LABELS: Record<string, string> = {
  nextjs: 'Next.js', react: 'React', vue: 'Vue', svelte: 'Svelte', angular: 'Angular',
  rust: 'Rust', go: 'Go', python: 'Python', ruby: 'Ruby', java: 'Java',
  typescript: 'TS', javascript: 'JS', php: 'PHP', cpp: 'C++', docker: 'Docker',
}

type TabId = 'frameworks' | 'emoji' | 'file'

// How many emojis to show per category before "Show more"
const CATEGORY_PREVIEW_COUNT = 32

const EMOJI_CATEGORIES = [
  {
    label: 'Dev & Tech',
    emojis: [
      '💻', '🖥️', '⌨️', '🖱️', '💾', '💿', '📀', '📡', '🔌', '🔋', '🧪', '🔬', '🤖', '🧠', '⚡', '🔧',
      '🛠️', '⚙️', '🔩', '🪛', '🔗', '📟', '📠', '☎️', '📺', '📻', '🎙️', '📷', '📸', '📹', '🎥', '📽️',
      '🖨️', '🖲️', '💡', '🔦', '🕹️', '🪙', '💳', '🏧', '🔐', '🔏', '🔒', '🔓', '🛰️', '🚀', '🛸', '🔭',
    ],
  },
  {
    label: 'Symbols & UI',
    emojis: [
      '✅', '❌', '⚠️', '❓', '❗', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶',
      '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔲', '🔳', '▶️', '⏸️', '⏹️', '⏭️', '⏮️', '🔄', '🔃',
      '⏫', '⏬', '⬆️', '⬇️', '⬅️', '➡️', '↩️', '↪️', '🔀', '🔁', '🔂', '🔛', '🔜', '🔝', '📶', '🆕',
      '🆙', '🆒', '🆓', '🆖', '🆗', '🆘', '🆚', '📵', '🚫', '⛔', '🚷', '🚯', '🚳', '🚱', '📛', '🔞',
    ],
  },
  {
    label: 'Objects & Tools',
    emojis: [
      '📦', '📚', '📝', '📄', '📃', '📋', '📁', '📂', '🗂️', '🗃️', '🗄️', '📊', '📈', '📉', '📑', '📌',
      '📍', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📐', '📏', '🗑️', '🗺️', '🧭', '⏱️', '⏲️', '🕰️', '⌛', '⏳',
      '📤', '📥', '📬', '📭', '📮', '📯', '📣', '📢', '🔔', '🔕', '🔖', '🏷️', '💰', '💴', '💵', '💶',
      '💷', '💸', '💹', '🏗️', '🏠', '🏢', '🏰', '🗼', '⚓', '🔑', '🗝️', '🛡️', '⚔️', '🏆', '🥇', '🎖️',
    ],
  },
  {
    label: 'Fun & Creative',
    emojis: [
      '🎮', '🕹️', '🎯', '🎨', '🎭', '🎪', '🎬', '🎵', '🎶', '🎸', '🎹', '🥁', '🎷', '🎺', '🎻', '🪕',
      '🎲', '🧩', '🪄', '✨', '💎', '🔮', '🌈', '🎠', '🎡', '🎢', '🎰', '🎳', '🏹', '🪃', '🥊', '🏋️',
      '🤸', '🧗', '🏄', '🛹', '🛼', '⛷️', '🏂', '🪂', '🤺', '🏇', '🧘', '🎿', '🛷', '🤼', '🤾', '🧨',
      '🎑', '🎆', '🎇', '🧧', '🎁', '🎀', '🎊', '🎉', '🪩', '🪅', '🎈', '🎋', '🎍', '🎎', '🎐', '🪔',
    ],
  },
  {
    label: 'Nature & Weather',
    emojis: [
      '🌸', '🌻', '🌹', '🌷', '🌺', '💐', '🌼', '🌵', '🌴', '🌲', '🌳', '🌱', '🌿', '☘️', '🍀', '🍁',
      '🍂', '🍃', '🍄', '🌾', '🌍', '🌎', '🌏', '🌐', '🗾', '🌑', '🌒', '🌓', '🌔', '🌕', '🌙', '⭐',
      '🌟', '💫', '✨', '⚡', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️',
      '❄️', '☃️', '⛄', '🌊', '💧', '💦', '🔥', '🌋', '🏔️', '⛰️', '🏕️', '🏖️', '🏜️', '🏝️', '🌅', '🌄',
    ],
  },
  {
    label: 'Animals',
    emojis: [
      '🐱', '🐶', '🦊', '🐼', '🦄', '🐙', '🦋', '🐝', '🦁', '🐯', '🐻', '🐨', '🐸', '🐵', '🦍', '🦧',
      '🦊', '🦝', '🐺', '🦌', '🐗', '🐴', '🦓', '🦒', '🐘', '🦏', '🦛', '🦑', '🦈', '🐬', '🐳', '🐋',
      '🦭', '🐊', '🐢', '🦎', '🐍', '🦕', '🦖', '🦗', '🐞', '🦟', '🦠', '🐓', '🦚', '🦜', '🦉', '🦅',
      '🐧', '🐦', '🦩', '🦢', '🕊️', '🐇', '🦔', '🐾', '🐉', '🦄', '🐲', '🦋', '🐛', '🐌', '🐜', '🐝',
    ],
  },
  {
    label: 'Food & Drinks',
    emojis: [
      '☕', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🫖',
      '🍕', '🍔', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥞', '🧇', '🥓', '🍟', '🌭', '🥪', '🍣', '🍱',
      '🍜', '🍝', '🍛', '🍲', '🥘', '🫕', '🍤', '🦞', '🦀', '🦐', '🐟', '🍩', '🧁', '🎂', '🍰', '🍪',
      '🍫', '🍬', '🍭', '🍮', '🍯', '🍎', '🍊', '🍋', '🍇', '🍓', '🫐', '🥝', '🍈', '🍑', '🥑', '🌶️',
    ],
  },
  {
    label: 'Travel & Places',
    emojis: [
      '🚗', '🚕', '🚙', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴',
      '🛺', '🚁', '✈️', '🛩️', '🚀', '🛸', '⛵', '🚢', '🛥️', '🚤', '⛴️', '🚂', '🚃', '🚄', '🚅', '🚆',
      '🚇', '🚈', '🚉', '🚊', '🚞', '🚋', '🛤️', '🛣️', '🗺️', '🏔️', '🏕️', '🏖️', '🏗️', '🏘️', '🏚️', '🏠',
      '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏧', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '🗼',
    ],
  },
  {
    label: 'Faces & People',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘',
      '😎', '🥳', '🤓', '😈', '👿', '👻', '💀', '👽', '🤠', '🥸', '😺', '😸', '😹', '😻', '😼', '😽',
      '🧑‍💻', '🧑‍🚀', '🧑‍🎨', '🧑‍🔬', '🧑‍🏫', '🧑‍🍳', '🧑‍🌾', '🧑‍🔧', '🧑‍🏭', '🧑‍💼', '🧑‍⚕️', '🧑‍🎤', '🥷', '🦸', '🦹', '🧙',
      '🧝', '🧛', '🧟', '🧞', '🧜', '🧚', '👾', '🤖', '👤', '👥', '🫂', '👶', '🧒', '👦', '👧', '🧑',
    ],
  },
  {
    label: 'Hand Gestures',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟',
      '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏',
      '🙌', '🫶', '👐', '🤲', '🙏', '🤝', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🫀', '🫁',
    ],
  },
  {
    label: 'Hearts & Love',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '❤️‍🔥', '❤️‍🩹', '💔', '❣️', '💕', '💞', '💓',
      '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '✡️', '🔯', '☯️', '☦️', '🛐', '💒', '💑',
    ],
  },
  {
    label: 'Sport & Activity',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🥅', '⛳', '🏒', '🏑',
      '🥍', '🏏', '🪃', '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️',
    ],
  },
] as const

type EmojiCategoryLabel = (typeof EMOJI_CATEGORIES)[number]['label']

const EMOJI_KEYWORDS: Record<string, readonly string[]> = {
  // Dev & Tech
  '💻': ['laptop', 'computer', 'dev', 'code'],
  '🖥️': ['desktop', 'monitor', 'screen', 'display'],
  '⌨️': ['keyboard', 'type', 'input'],
  '🖱️': ['mouse', 'click', 'cursor'],
  '💾': ['save', 'disk', 'floppy', 'storage'],
  '💿': ['cd', 'disc', 'optical', 'media'],
  '📀': ['dvd', 'disc', 'optical', 'media'],
  '📡': ['satellite', 'signal', 'network', 'api'],
  '🔌': ['plugin', 'power', 'connect', 'electric'],
  '🔋': ['battery', 'charge', 'power', 'energy'],
  '🧪': ['test', 'experiment', 'lab', 'science'],
  '🔬': ['microscope', 'research', 'science', 'debug'],
  '🤖': ['robot', 'bot', 'ai', 'automation'],
  '🧠': ['brain', 'ai', 'smart', 'think', 'ml'],
  '⚡': ['lightning', 'fast', 'power', 'energy', 'zap'],
  '🔧': ['wrench', 'fix', 'tool', 'repair', 'config'],
  '🛠️': ['tools', 'build', 'hammer', 'construct'],
  '⚙️': ['gear', 'settings', 'config', 'engine'],
  '🔩': ['bolt', 'nut', 'hardware', 'metal'],
  '🪛': ['screwdriver', 'tool', 'fix', 'repair'],
  '🔗': ['link', 'chain', 'connect', 'url'],
  '📟': ['pager', 'beeper', 'device', 'retro'],
  '📠': ['fax', 'machine', 'print', 'document'],
  '☎️': ['phone', 'call', 'telephone', 'old'],
  '📺': ['tv', 'television', 'screen', 'media'],
  '📻': ['radio', 'broadcast', 'audio', 'frequency'],
  '🎙️': ['mic', 'microphone', 'recording', 'podcast'],
  '📷': ['camera', 'photo', 'picture', 'snapshot'],
  '📸': ['camera', 'flash', 'selfie', 'photo'],
  '📹': ['video', 'camera', 'record', 'film'],
  '🎥': ['movie', 'film', 'cinema', 'video'],
  '📽️': ['projector', 'film', 'movie', 'cinema'],
  '🖨️': ['printer', 'print', 'paper', 'document'],
  '🖲️': ['trackball', 'mouse', 'input', 'hardware'],
  '💡': ['bulb', 'idea', 'light', 'tip', 'bright'],
  '🔦': ['flashlight', 'torch', 'light', 'dark'],
  '🕹️': ['joystick', 'game', 'controller', 'arcade'],
  '🪙': ['coin', 'money', 'gold', 'token'],
  '💳': ['card', 'credit', 'payment', 'wallet'],
  '🏧': ['atm', 'bank', 'cash', 'machine'],
  '🔐': ['locked', 'secure', 'key', 'auth'],
  '🔏': ['locked', 'pen', 'sign', 'secure'],
  '🔒': ['lock', 'secure', 'locked', 'private'],
  '🔓': ['unlock', 'open', 'access', 'public'],
  '🛰️': ['satellite', 'orbit', 'space', 'broadcast'],
  '🚀': ['rocket', 'launch', 'deploy', 'fast', 'ship'],
  '🛸': ['ufo', 'alien', 'space', 'fly'],
  '🔭': ['telescope', 'space', 'star', 'observe'],
  // Symbols & UI
  '✅': ['check', 'done', 'complete', 'ok', 'yes', 'pass'],
  '❌': ['cross', 'no', 'fail', 'error', 'wrong', 'delete'],
  '⚠️': ['warning', 'caution', 'alert', 'danger'],
  '❓': ['question', 'help', 'unknown', 'ask'],
  '❗': ['exclamation', 'alert', 'important', 'urgent'],
  '💯': ['hundred', 'perfect', 'score', 'full', 'complete'],
  '🔴': ['red', 'dot', 'circle', 'error', 'stop'],
  '🟠': ['orange', 'dot', 'circle', 'warning'],
  '🟡': ['yellow', 'dot', 'circle', 'caution'],
  '🟢': ['green', 'dot', 'circle', 'success', 'ok'],
  '🔵': ['blue', 'dot', 'circle', 'info'],
  '🟣': ['purple', 'dot', 'circle', 'violet'],
  '⚫': ['black', 'dot', 'circle', 'dark'],
  '⚪': ['white', 'dot', 'circle', 'empty'],
  '🔶': ['orange', 'diamond', 'shape', 'warning'],
  '🔷': ['blue', 'diamond', 'shape', 'info'],
  '🔸': ['orange', 'diamond', 'small', 'shape'],
  '🔹': ['blue', 'diamond', 'small', 'shape'],
  '🔺': ['red', 'triangle', 'up', 'alert'],
  '🔻': ['red', 'triangle', 'down', 'sort'],
  '💠': ['diamond', 'blue', 'crystal', 'shape'],
  '🔘': ['radio', 'button', 'select', 'option'],
  '🔲': ['button', 'square', 'black', 'press'],
  '🔳': ['button', 'square', 'white', 'press'],
  '▶️': ['play', 'start', 'run', 'button'],
  '⏸️': ['pause', 'stop', 'wait', 'hold'],
  '⏹️': ['stop', 'end', 'square', 'halt'],
  '⏭️': ['next', 'skip', 'forward', 'fast'],
  '⏮️': ['previous', 'back', 'rewind', 'start'],
  '🔄': ['refresh', 'reload', 'sync', 'rotate'],
  '🔃': ['reload', 'clockwise', 'refresh', 'sync'],
  '⏫': ['up', 'fast', 'scroll', 'top'],
  '⏬': ['down', 'fast', 'scroll', 'bottom'],
  '⬆️': ['up', 'arrow', 'above', 'top'],
  '⬇️': ['down', 'arrow', 'below', 'bottom'],
  '⬅️': ['left', 'arrow', 'back', 'previous'],
  '➡️': ['right', 'arrow', 'forward', 'next'],
  '↩️': ['return', 'back', 'undo', 'reply'],
  '↪️': ['return', 'forward', 'redo', 'reply'],
  '🔀': ['shuffle', 'random', 'mix', 'switch'],
  '🔁': ['repeat', 'loop', 'again', 'cycle'],
  '🔂': ['repeat', 'once', 'loop', 'single'],
  '📶': ['signal', 'wifi', 'bars', 'network'],
  '🆕': ['new', 'badge', 'label', 'fresh'],
  '🆙': ['up', 'badge', 'upgrade', 'improve'],
  '🆒': ['cool', 'badge', 'nice', 'ok'],
  '🆓': ['free', 'badge', 'gratis', 'no cost'],
  '🆖': ['ng', 'badge', 'no good', 'fail'],
  '🆗': ['ok', 'badge', 'good', 'accept'],
  '🆘': ['sos', 'help', 'emergency', 'distress'],
  '🆚': ['vs', 'versus', 'compare', 'against'],
  '🚫': ['no', 'ban', 'forbidden', 'block', 'disabled'],
  '⛔': ['stop', 'no', 'entry', 'banned'],
  // Objects & Tools
  '📦': ['package', 'box', 'npm', 'cargo', 'ship', 'bundle'],
  '📚': ['books', 'library', 'docs', 'read', 'learn'],
  '📝': ['note', 'memo', 'write', 'edit', 'pencil'],
  '📄': ['page', 'document', 'file', 'text'],
  '📃': ['curl', 'page', 'scroll', 'document'],
  '📋': ['clipboard', 'list', 'paste', 'copy'],
  '📁': ['folder', 'directory', 'file', 'open'],
  '📂': ['open', 'folder', 'directory', 'expand'],
  '🗂️': ['folder', 'tab', 'file', 'organize', 'index'],
  '🗃️': ['box', 'files', 'cards', 'archive'],
  '🗄️': ['cabinet', 'drawer', 'file', 'storage'],
  '📊': ['chart', 'bar', 'graph', 'data', 'stats'],
  '📈': ['chart', 'growth', 'up', 'increase', 'trend'],
  '📉': ['chart', 'decline', 'down', 'decrease', 'trend'],
  '📑': ['tabs', 'pages', 'document', 'bookmark'],
  '📌': ['pin', 'push', 'note', 'location', 'mark'],
  '📍': ['pin', 'location', 'map', 'place', 'mark'],
  '🖊️': ['pen', 'write', 'edit', 'sign'],
  '🖋️': ['fountain', 'pen', 'write', 'fancy'],
  '✒️': ['nib', 'pen', 'calligraphy', 'write'],
  '🖌️': ['paintbrush', 'art', 'paint', 'design'],
  '🖍️': ['crayon', 'draw', 'color', 'art'],
  '📐': ['ruler', 'triangle', 'measure', 'angle'],
  '📏': ['ruler', 'measure', 'straight', 'length'],
  '🗑️': ['trash', 'delete', 'bin', 'garbage', 'remove'],
  '🗺️': ['map', 'world', 'navigate', 'explore'],
  '🧭': ['compass', 'navigate', 'direction', 'explore'],
  '⏱️': ['timer', 'stopwatch', 'time', 'clock', 'fast'],
  '⏲️': ['timer', 'clock', 'alarm', 'countdown'],
  '🕰️': ['mantelpiece', 'clock', 'time', 'old'],
  '⌛': ['hourglass', 'time', 'wait', 'sand'],
  '⏳': ['hourglass', 'time', 'wait', 'flow'],
  '📤': ['outbox', 'send', 'upload', 'out'],
  '📥': ['inbox', 'receive', 'download', 'in'],
  '📬': ['mailbox', 'email', 'message', 'receive'],
  '📭': ['empty', 'mailbox', 'email', 'no mail'],
  '📮': ['mailbox', 'post', 'letter', 'mail'],
  '📯': ['horn', 'announce', 'trumpet', 'bugle'],
  '📣': ['megaphone', 'loud', 'announce', 'shout'],
  '📢': ['loudspeaker', 'announce', 'broadcast', 'speak'],
  '🔔': ['bell', 'alert', 'notification', 'sound'],
  '🔕': ['mute', 'silent', 'no bell', 'quiet'],
  '🔖': ['bookmark', 'save', 'mark', 'label'],
  '🏷️': ['tag', 'label', 'price', 'mark'],
  '💰': ['money', 'bag', 'cash', 'rich', 'gold'],
  '💸': ['money', 'fly', 'spend', 'expensive'],
  '💹': ['chart', 'yen', 'increase', 'market'],
  '🏗️': ['construction', 'build', 'crane', 'wip'],
  '🏠': ['house', 'home', 'building'],
  '🏢': ['office', 'building', 'work', 'company'],
  '🏰': ['castle', 'fortress', 'kingdom', 'medieval'],
  '⚓': ['anchor', 'ship', 'port', 'stable'],
  '🔑': ['key', 'lock', 'auth', 'secret', 'access'],
  '🗝️': ['old', 'key', 'lock', 'vintage'],
  '🛡️': ['shield', 'protect', 'security', 'guard', 'safe'],
  '⚔️': ['sword', 'battle', 'fight', 'cross', 'duel'],
  '🏆': ['trophy', 'win', 'champion', 'award', 'gold'],
  '🥇': ['gold', 'medal', 'first', 'win', 'best'],
  // Fun & Creative
  '🎮': ['game', 'controller', 'play', 'gaming'],
  '🎯': ['target', 'goal', 'aim', 'focus', 'dart'],
  '🎨': ['art', 'paint', 'design', 'palette', 'creative'],
  '🎭': ['theater', 'drama', 'mask', 'perform'],
  '🎪': ['circus', 'tent', 'carnival', 'fun'],
  '🎬': ['movie', 'film', 'video', 'action', 'camera'],
  '🎵': ['music', 'note', 'song', 'audio', 'sound'],
  '🎶': ['music', 'notes', 'melody', 'song', 'audio'],
  '🎸': ['guitar', 'rock', 'music', 'band'],
  '🎹': ['piano', 'keys', 'music', 'keyboard'],
  '🥁': ['drums', 'beat', 'rhythm', 'music'],
  '🎷': ['saxophone', 'jazz', 'music', 'sax'],
  '🎺': ['trumpet', 'brass', 'music', 'fanfare'],
  '🎻': ['violin', 'classical', 'music', 'strings'],
  '🪕': ['banjo', 'folk', 'country', 'music'],
  '🎲': ['dice', 'random', 'game', 'chance', 'luck'],
  '🧩': ['puzzle', 'piece', 'fit', 'solve', 'module'],
  '🪄': ['wand', 'magic', 'wizard', 'spell'],
  '✨': ['sparkle', 'star', 'new', 'shine', 'magic'],
  '💎': ['gem', 'diamond', 'ruby', 'jewel', 'premium'],
  '🔮': ['crystal', 'ball', 'predict', 'magic', 'future'],
  '🌈': ['rainbow', 'color', 'pride', 'spectrum'],
  '🎉': ['party', 'celebrate', 'confetti', 'fun'],
  '🎊': ['confetti', 'party', 'celebrate', 'festival'],
  '🎈': ['balloon', 'party', 'float', 'celebrate'],
  '🎁': ['gift', 'present', 'birthday', 'wrap'],
  '🎀': ['ribbon', 'bow', 'gift', 'pink'],
  // Nature & Weather
  '🌸': ['blossom', 'flower', 'cherry', 'spring', 'pink'],
  '🌻': ['sunflower', 'flower', 'sun', 'yellow', 'happy'],
  '🌹': ['rose', 'flower', 'red', 'love'],
  '🌷': ['tulip', 'flower', 'spring', 'pink'],
  '🌺': ['hibiscus', 'flower', 'tropical', 'red'],
  '💐': ['bouquet', 'flowers', 'gift', 'garden'],
  '🌼': ['daisy', 'flower', 'yellow', 'spring'],
  '🌵': ['cactus', 'desert', 'plant', 'prickly'],
  '🌴': ['palm', 'tree', 'tropical', 'beach'],
  '🌲': ['evergreen', 'tree', 'pine', 'forest'],
  '🌳': ['deciduous', 'tree', 'park', 'nature'],
  '🌱': ['seedling', 'grow', 'new', 'plant', 'sprout'],
  '🌿': ['herb', 'plant', 'green', 'leaf'],
  '☘️': ['shamrock', 'clover', 'luck', 'irish'],
  '🍀': ['four leaf', 'clover', 'luck', 'fortune'],
  '🍁': ['maple', 'leaf', 'autumn', 'fall', 'canada'],
  '🍂': ['fallen', 'leaf', 'autumn', 'fall'],
  '🍃': ['leaf', 'wind', 'green', 'flutter'],
  '🍄': ['mushroom', 'fungus', 'toad', 'nature'],
  '🌾': ['wheat', 'grain', 'stalk', 'harvest'],
  '🌍': ['earth', 'globe', 'world', 'planet', 'global', 'europe'],
  '🌎': ['earth', 'globe', 'world', 'planet', 'global', 'americas'],
  '🌏': ['earth', 'globe', 'world', 'planet', 'global', 'asia'],
  '🌐': ['web', 'internet', 'globe', 'network', 'global'],
  '🌙': ['moon', 'night', 'dark', 'crescent', 'sleep'],
  '⭐': ['star', 'favorite', 'bookmark', 'rate'],
  '🌟': ['glowing', 'star', 'bright', 'special'],
  '☀️': ['sun', 'bright', 'light', 'day', 'warm'],
  '🌪️': ['tornado', 'wind', 'spin', 'whirlwind'],
  '❄️': ['snow', 'ice', 'cold', 'winter', 'freeze'],
  '🔥': ['fire', 'hot', 'flame', 'lit', 'trending'],
  '💧': ['drop', 'water', 'liquid', 'rain'],
  '💦': ['sweat', 'water', 'splash', 'wet'],
  '🌊': ['wave', 'ocean', 'sea', 'surf', 'water'],
  // Animals
  '🐱': ['cat', 'kitten', 'meow', 'pet'],
  '🐶': ['dog', 'puppy', 'woof', 'pet'],
  '🦊': ['fox', 'firefox', 'clever', 'orange'],
  '🐼': ['panda', 'bear', 'bamboo', 'cute'],
  '🦄': ['unicorn', 'magic', 'horse', 'startup'],
  '🐙': ['octopus', 'github', 'tentacle', 'sea'],
  '🦋': ['butterfly', 'flutter', 'insect', 'transform'],
  '🐝': ['bee', 'honey', 'buzz', 'busy', 'hive'],
  '🦁': ['lion', 'king', 'brave', 'roar'],
  '🐯': ['tiger', 'stripe', 'fierce', 'cat'],
  '🐻': ['bear', 'cute', 'brown', 'hibernate'],
  '🐨': ['koala', 'australia', 'eucalyptus', 'cute'],
  '🐸': ['frog', 'jump', 'green', 'ribbit'],
  '🐵': ['monkey', 'ape', 'primate', 'banana'],
  '🐍': ['snake', 'python', 'slither', 'reptile'],
  '🦕': ['dinosaur', 'sauropod', 'prehistoric', 'long'],
  '🦖': ['trex', 'dinosaur', 'prehistoric', 'roar'],
  '🐬': ['dolphin', 'smart', 'ocean', 'swim'],
  '🐳': ['whale', 'ocean', 'big', 'water'],
  '🦈': ['shark', 'ocean', 'predator', 'fish'],
  '🐢': ['turtle', 'slow', 'shell', 'reptile'],
  '🐧': ['penguin', 'linux', 'arctic', 'bird'],
  '🦅': ['eagle', 'freedom', 'soar', 'bird'],
  '🦉': ['owl', 'wise', 'night', 'bird'],
  '🦜': ['parrot', 'colorful', 'talk', 'bird'],
  '🐉': ['dragon', 'fire', 'mythical', 'beast'],
  // Food & Drinks
  '☕': ['coffee', 'java', 'drink', 'morning', 'cafe'],
  '🍵': ['tea', 'cup', 'drink', 'warm'],
  '🧃': ['juice', 'drink', 'box', 'straw'],
  '🥤': ['cup', 'straw', 'drink', 'soda'],
  '🧋': ['boba', 'bubble tea', 'drink', 'tapioca'],
  '🍺': ['beer', 'drink', 'pub', 'cheers'],
  '🍻': ['beers', 'cheer', 'toast', 'celebration'],
  '🥂': ['champagne', 'toast', 'celebrate', 'sparkle'],
  '🍷': ['wine', 'drink', 'glass', 'red'],
  '🧊': ['ice', 'cold', 'cube', 'freeze', 'cool'],
  '🍕': ['pizza', 'food', 'slice', 'italian'],
  '🍔': ['burger', 'food', 'hamburger', 'fast'],
  '🌮': ['taco', 'food', 'mexican'],
  '🍣': ['sushi', 'food', 'japanese', 'fish'],
  '🍩': ['donut', 'food', 'sweet', 'snack'],
  '🧁': ['cupcake', 'cake', 'sweet', 'dessert'],
  '🍪': ['cookie', 'sweet', 'snack', 'biscuit'],
  '🍎': ['apple', 'fruit', 'red', 'mac'],
  '🍋': ['lemon', 'fruit', 'yellow', 'sour', 'citrus'],
  '🥑': ['avocado', 'fruit', 'green', 'guac'],
  '🌶️': ['pepper', 'hot', 'spicy', 'chili'],
  // Faces & People
  '😀': ['grin', 'happy', 'smile', 'joy'],
  '😎': ['cool', 'sunglasses', 'chill', 'awesome'],
  '🥳': ['party', 'celebrate', 'birthday', 'confetti'],
  '🤓': ['nerd', 'geek', 'smart', 'glasses'],
  '😈': ['devil', 'evil', 'mischief', 'imp'],
  '👻': ['ghost', 'boo', 'spooky', 'halloween'],
  '💀': ['skull', 'dead', 'danger', 'skeleton'],
  '👽': ['alien', 'ufo', 'space', 'extraterrestrial'],
  '🤠': ['cowboy', 'hat', 'western', 'yeehaw'],
  '🧑‍💻': ['developer', 'coder', 'programmer', 'hacker'],
  '🧑‍🚀': ['astronaut', 'space', 'nasa', 'cosmonaut'],
  '🧑‍🎨': ['artist', 'painter', 'creative', 'designer'],
  '🧑‍🔬': ['scientist', 'lab', 'research', 'chemist'],
  '🥷': ['ninja', 'stealth', 'warrior', 'silent'],
  '🦸': ['hero', 'super', 'cape', 'power'],
  '🧙': ['wizard', 'mage', 'magic', 'merlin'],
  '👾': ['alien', 'invader', 'arcade', 'pixel', 'retro'],
  '🥸': ['disguise', 'glasses', 'fake', 'incognito'],
  // Hand Gestures
  '👋': ['wave', 'hello', 'bye', 'greet'],
  '👍': ['thumbs', 'up', 'like', 'good', 'approve'],
  '👎': ['thumbs', 'down', 'dislike', 'bad', 'reject'],
  '👏': ['clap', 'applause', 'bravo', 'congrats'],
  '🙌': ['raise', 'celebrate', 'high five', 'yay'],
  '🤝': ['handshake', 'deal', 'agree', 'partnership'],
  '🙏': ['pray', 'please', 'thank', 'namaste'],
  '💪': ['muscle', 'strong', 'flex', 'power'],
  '✌️': ['peace', 'two', 'victory', 'v'],
  '🤞': ['cross', 'fingers', 'hope', 'luck'],
  '🤟': ['love', 'hand', 'ily', 'sign'],
  '🤘': ['rock', 'metal', 'sign', 'horn'],
  '☝️': ['point', 'up', 'one', 'first'],
  // Hearts & Love
  '❤️': ['heart', 'love', 'red', 'care'],
  '🧡': ['orange', 'heart', 'love', 'warm'],
  '💛': ['yellow', 'heart', 'love', 'happy'],
  '💚': ['green', 'heart', 'love', 'nature'],
  '💙': ['blue', 'heart', 'love', 'calm'],
  '💜': ['purple', 'heart', 'love', 'royalty'],
  '🖤': ['black', 'heart', 'dark', 'gothic'],
  '🤍': ['white', 'heart', 'pure', 'clean'],
  '💔': ['broken', 'heart', 'sad', 'loss'],
  '❤️‍🔥': ['heart', 'fire', 'passion', 'intense'],
  '💕': ['two', 'hearts', 'love', 'cute'],
  '💖': ['sparkling', 'heart', 'love', 'shine'],
  '💗': ['growing', 'heart', 'love', 'pink'],
  '💘': ['heart', 'arrow', 'cupid', 'love'],
  '💝': ['gift', 'heart', 'love', 'present'],
  // Sport & Activity
  '⚽': ['soccer', 'football', 'sport', 'kick'],
  '🏀': ['basketball', 'sport', 'hoop', 'ball'],
  '🏈': ['football', 'american', 'sport', 'nfl'],
  '⚾': ['baseball', 'sport', 'bat', 'ball'],
  '🎾': ['tennis', 'sport', 'racket', 'ball'],
  '🏐': ['volleyball', 'sport', 'net', 'ball'],
  '🏉': ['rugby', 'sport', 'oval', 'ball'],
  '🎱': ['pool', 'billiards', 'eight ball', 'sport'],
  '🏓': ['ping pong', 'table tennis', 'paddle', 'sport'],
  '🏸': ['badminton', 'shuttlecock', 'racket', 'sport'],
  '⛳': ['golf', 'flag', 'hole', 'sport'],
  '🥊': ['boxing', 'glove', 'fight', 'sport'],
  // Travel
  '🚗': ['car', 'drive', 'vehicle', 'auto'],
  '✈️': ['plane', 'fly', 'travel', 'airport'],
  '🚂': ['train', 'rail', 'steam', 'locomotive'],
  '🚢': ['ship', 'sea', 'cruise', 'boat'],
  '🚁': ['helicopter', 'fly', 'rotor', 'air'],
  '🏔️': ['mountain', 'peak', 'climb', 'snow'],
  '🏖️': ['beach', 'sand', 'vacation', 'sea'],
  '🏕️': ['camping', 'tent', 'outdoor', 'nature'],
} as const

const getMimeType = (ext: string): string => {
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
  }
  return map[ext] ?? 'application/octet-stream'
}

export const IconPickerDialog = memo(function IconPickerDialog({
  open, onOpenChange, cwd, onSelect, onReset,
}: IconPickerDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>('frameworks')
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null)
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [emojiSearch, setEmojiSearch] = useState('')
  const [imageFiles, setImageFiles] = useState<Array<{ path: string; width: number; height: number }>>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState(false)
  // Track expanded categories (only relevant when no search query)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Reset state when dialog opens
  useEffect(() => {
    if (!open) return
    setActiveTab('frameworks')
    setSelectedFramework(null)
    setSelectedEmoji(null)
    setSelectedFile(null)
    setSearchQuery('')
    setEmojiSearch('')
    setPreviewUrl(null)
    setPreviewError(false)
    setExpandedCategories(new Set())
    let stale = false
    const loadFiles = async (): Promise<void> => {
      try {
        const files = await ipc.listSmallImages(cwd, MAX_IMAGE_SIZE_PX)
        if (stale) return
        setImageFiles(files)
      } catch {
        if (!stale) setImageFiles([])
      }
    }
    void loadFiles()
    return () => { stale = true }
  }, [open, cwd])

  // Load preview for selected file
  useEffect(() => {
    if (!selectedFile || !cwd) { setPreviewUrl(null); setPreviewError(false); return }
    let stale = false
    const loadPreview = async (): Promise<void> => {
      try {
        const base64 = await ipc.readFileBase64(cwd + '/' + selectedFile)
        if (stale || !base64) return
        const ext = selectedFile.split('.').pop()?.toLowerCase() ?? 'png'
        const url = `data:${getMimeType(ext)};base64,${base64}`
        setPreviewUrl(url)
        setPreviewError(false)
      } catch {
        if (!stale) { setPreviewUrl(null); setPreviewError(true) }
      }
    }
    void loadPreview()
    return () => { stale = true }
  }, [selectedFile, cwd])

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return imageFiles
    return imageFiles
      .map((f) => ({ file: f, score: fuzzyScore(searchQuery, f.path) }))
      .filter((r) => r.score !== null)
      .sort((a, b) => a.score! - b.score!)
      .map((r) => r.file)
  }, [imageFiles, searchQuery])

  const filteredEmojiCategories = useMemo(() => {
    const query = emojiSearch.trim().toLowerCase()
    if (!query) {
      // No search: return all categories (rendering is capped per-category)
      return EMOJI_CATEGORIES.map((cat) => ({ ...cat, emojis: [...cat.emojis] as string[] }))
    }
    // Search: filter by keyword match, show all matching emojis
    const matched = EMOJI_CATEGORIES
      .map((cat) => ({
        ...cat,
        emojis: (cat.emojis as readonly string[]).filter((emoji) => {
          const keywords = (EMOJI_KEYWORDS as Record<string, readonly string[]>)[emoji]
          if (!keywords) return false
          return keywords.some((kw) => kw.includes(query)) || emoji === query
        }),
      }))
      .filter((cat) => cat.emojis.length > 0)
    return matched
  }, [emojiSearch])

  const selectedImage = useMemo(() => {
    if (!selectedFile) return null
    return imageFiles.find((f) => f.path === selectedFile) ?? null
  }, [imageFiles, selectedFile])

  const handleSelectFramework = useCallback((id: string) => {
    setSelectedFramework(id)
    setSelectedEmoji(null)
    setSelectedFile(null)
    setPreviewUrl(null)
  }, [])

  const handleConfirmFramework = useCallback(() => {
    if (!selectedFramework) return
    onSelect({ type: 'framework', id: selectedFramework })
  }, [selectedFramework, onSelect])

  const handleSelectEmoji = useCallback((emoji: string) => {
    setSelectedEmoji(emoji)
    setSelectedFramework(null)
    setSelectedFile(null)
    setPreviewUrl(null)
  }, [])

  const handleConfirmEmoji = useCallback(() => {
    if (!selectedEmoji) return
    onSelect({ type: 'emoji', emoji: selectedEmoji })
  }, [selectedEmoji, onSelect])

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path)
    setSelectedFramework(null)
    setSelectedEmoji(null)
  }, [])

  const handleConfirmFile = useCallback(() => {
    if (!selectedFile) return
    onSelect({ type: 'file', path: selectedFile })
  }, [selectedFile, onSelect])

  const handleReset = useCallback(() => {
    setSelectedFramework(null)
    setSelectedEmoji(null)
    setSelectedFile(null)
    setPreviewUrl(null)
    onReset()
  }, [onReset])

  const toggleCategoryExpand = useCallback((label: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  const canConfirm = activeTab === 'frameworks'
    ? !!selectedFramework
    : activeTab === 'emoji'
      ? !!selectedEmoji
      : !!selectedFile && !previewError

  const isSearching = emojiSearch.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-3">
          <DialogTitle className="text-sm font-medium">Change Icon</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border px-5">
          <button
            type="button"
            onClick={() => setActiveTab('frameworks')}
            className={cn(
              'px-3 py-2 text-[12px] font-medium transition-colors border-b-2 -mb-px outline-none',
              activeTab === 'frameworks'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Frameworks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={cn(
              'px-3 py-2 text-[12px] font-medium transition-colors border-b-2 -mb-px outline-none',
              activeTab === 'emoji'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Emoji
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={cn(
              'px-3 py-2 text-[12px] font-medium transition-colors border-b-2 -mb-px outline-none',
              activeTab === 'file'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Project File
          </button>
        </div>

        <div className="flex flex-col px-5 pb-4 pt-3">
          {/* Frameworks tab */}
          {activeTab === 'frameworks' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-5 gap-1">
                {FRAMEWORK_IDS.map((id) => {
                  const Icon = FRAMEWORK_ICONS[id]
                  if (!Icon) return null
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-label={`Select ${FRAMEWORK_LABELS[id]} icon`}
                      tabIndex={0}
                      onClick={() => handleSelectFramework(id)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-md px-1.5 py-1.5 transition-colors hover:bg-accent outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        selectedFramework === id && 'ring-1 ring-primary bg-accent',
                      )}
                    >
                      <Icon className="size-6 shrink-0" aria-hidden />
                      <span className="text-[10px] text-muted-foreground truncate w-full text-center leading-tight">{FRAMEWORK_LABELS[id]}</span>
                    </button>
                  )
                })}
              </div>

              {/* Preview */}
              {selectedFramework && (
                <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-background border border-border">
                    {(() => { const Icon = FRAMEWORK_ICONS[selectedFramework]; return Icon ? <Icon className="size-7 rounded-full" aria-hidden /> : null })()}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12px] font-medium text-foreground">{FRAMEWORK_LABELS[selectedFramework]}</span>
                    <span className="text-[10px] text-muted-foreground">Framework icon</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Emoji tab */}
          {activeTab === 'emoji' && (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  type="text"
                  placeholder="Search emojis…"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  aria-label="Search emojis by keyword"
                  className="h-7 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-[12px] outline-none placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="max-h-[260px] overflow-y-auto flex flex-col gap-2.5 pr-0.5">
                {filteredEmojiCategories.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-[11px] text-muted-foreground/60">
                    No emojis match &ldquo;{emojiSearch}&rdquo;
                  </div>
                ) : filteredEmojiCategories.map((category) => {
                  const isExpanded = expandedCategories.has(category.label)
                  const visibleEmojis = (!isSearching && !isExpanded)
                    ? category.emojis.slice(0, CATEGORY_PREVIEW_COUNT)
                    : category.emojis
                  const hasMore = !isSearching && category.emojis.length > CATEGORY_PREVIEW_COUNT
                  return (
                    <div key={category.label} className="flex flex-col gap-1">
                      <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">{category.label}</span>
                      <div className="grid grid-cols-8 gap-0.5">
                        {visibleEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            aria-label={`Select ${emoji} emoji`}
                            tabIndex={0}
                            onClick={() => handleSelectEmoji(emoji)}
                            className={cn(
                              'flex items-center justify-center rounded-md p-1 text-lg transition-colors hover:bg-accent outline-none focus-visible:ring-1 focus-visible:ring-ring',
                              selectedEmoji === emoji && 'ring-1 ring-primary bg-accent',
                            )}
                          >
                            <span aria-hidden>{emoji}</span>
                          </button>
                        ))}
                      </div>
                      {hasMore && (
                        <button
                          type="button"
                          onClick={() => toggleCategoryExpand(category.label)}
                          className="flex items-center gap-1 self-start rounded px-1 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                        >
                          <IconChevronDown className={cn('size-3 transition-transform', isExpanded && 'rotate-180')} aria-hidden />
                          {isExpanded ? 'Show less' : `+${category.emojis.length - CATEGORY_PREVIEW_COUNT} more`}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Preview */}
              {selectedEmoji && (
                <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-background border border-border">
                    <span className="text-xl" aria-hidden>{selectedEmoji}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12px] font-medium text-foreground">Emoji icon</span>
                    <span className="text-[10px] text-muted-foreground">Custom emoji</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File tab — 2 column layout */}
          {activeTab === 'file' && (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  type="text"
                  placeholder="Search images..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search project image files"
                  className="h-7 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-[12px] outline-none placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex gap-3 min-h-[200px]">
                {/* Left: file list */}
                <div className="flex-1 min-w-0 max-h-[200px] overflow-y-auto rounded-md border border-border">
                  {filteredFiles.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-4 text-[11px] text-muted-foreground/60">
                      No image files found
                    </div>
                  ) : (
                    <ul role="listbox" aria-label="Project image files">
                      {filteredFiles.map((file) => (
                        <li key={file.path} role="option" aria-selected={selectedFile === file.path}>
                          <button
                            type="button"
                            tabIndex={0}
                            onClick={() => { handleSelectFile(file.path); setPreviewError(false) }}
                            className={cn(
                              'flex w-full items-center gap-2 px-2.5 py-1 text-left text-[11px] transition-colors hover:bg-accent outline-none focus-visible:bg-accent',
                              selectedFile === file.path && 'bg-accent text-accent-foreground',
                            )}
                          >
                            <IconPhoto className="size-3 shrink-0 text-muted-foreground/50" aria-hidden />
                            <span className="truncate text-foreground/80">{file.path}</span>
                            <span className="shrink-0 text-[9px] text-muted-foreground/50 ml-auto">{file.width === 0 && file.height === 0 ? 'SVG' : `${file.width}×${file.height}`}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Right: preview */}
                <div className="w-[140px] shrink-0 flex flex-col items-center justify-center rounded-md border border-border bg-muted/20 p-2">
                  {selectedFile && previewUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center justify-center size-16 rounded-full bg-background border border-border overflow-hidden">
                        <img
                          src={previewUrl}
                          alt=""
                          className="max-w-[56px] max-h-[56px] rounded-full object-cover"
                          aria-hidden
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground text-center truncate w-full">{selectedFile.split('/').pop()}</span>
                      {selectedImage && (
                        <span className="text-[9px] text-muted-foreground/60">{selectedImage.width === 0 && selectedImage.height === 0 ? 'SVG (vector)' : `${selectedImage.width}×${selectedImage.height}px`}</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-center">
                      <IconPhoto className="size-6 text-muted-foreground/30" aria-hidden />
                      <span className="text-[10px] text-muted-foreground/50 leading-tight">Select a file to preview</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-3 mt-1 border-t border-border/50">
            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset to auto-detect icon"
              className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <IconRefresh className="size-3" aria-hidden />
              Reset
            </button>
            <button
              type="button"
              onClick={activeTab === 'frameworks' ? handleConfirmFramework : activeTab === 'emoji' ? handleConfirmEmoji : handleConfirmFile}
              disabled={!canConfirm}
              aria-label="Apply selected icon"
              className="flex h-7 items-center rounded-md bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Apply
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})
