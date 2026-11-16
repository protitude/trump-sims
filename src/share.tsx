import { useEffect, useMemo, useState } from 'react';
import { ENDINGS, SITE_URL, bragPost, finalStats } from './game/brag.ts';
import { dateLabel } from './game/engine.ts';
import { legacyTitle } from './game/epilogue.ts';
import type { GameState } from './game/types.ts';

// The ending screen as a picture, and the buttons that post it. Share links can
// carry text but not an image, so the image is copied to the clipboard on the
// way out, to be pasted into the post.

const W = 1080;
const PAD = 84;
const INNER = W - PAD * 2;
const C = {
  bg: '#0d1326',
  panel: '#19223f',
  panel2: '#212c50',
  line: '#34406b',
  text: '#f1ecdd',
  muted: '#a9adc4',
  gold: '#e3b341',
  gold2: '#f6d67a',
  goldInk: '#2a1e00',
  bad: '#ff7a6b',
  blue: '#6aa8ff',
};
const SERIF = "Didot, 'Bodoni 72', 'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const FILE_NAME = 'executive-time-legacy.png';

type Ctx = CanvasRenderingContext2D;

function wrap(c: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && c.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws wrapped text in the current font and returns the y below it. */
function para(c: Ctx, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  for (const line of wrap(c, text, maxWidth)) {
    c.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function box(c: Ctx, x: number, y: number, w: number, h: number, radius: number, fill: string, stroke?: string): void {
  c.beginPath();
  c.roundRect(x, y, w, h, radius);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.stroke();
  }
}

/** Draws the card from the top down and returns its full height, so it can be measured before it is drawn for real. */
function paint(c: Ctx, s: GameState, post: string, height: number): number {
  // The plaque: the same navy panel and gold rule as the ending screen.
  c.fillStyle = C.bg;
  c.fillRect(0, 0, W, height);
  const glow = c.createRadialGradient(W / 2, -80, 0, W / 2, -80, 900);
  glow.addColorStop(0, '#24305c');
  glow.addColorStop(1, 'rgb(13 19 38 / 0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, W, height);
  box(c, 30, 30, W - 60, height - 60, 12, C.panel, C.gold);

  c.textBaseline = 'top';
  c.textAlign = 'left';
  let y = 92;

  c.font = `600 25px ${SANS}`;
  c.fillStyle = C.muted;
  c.letterSpacing = '5px';
  c.fillText(`EXECUTIVE TIME · ${s.status === 'won' ? 'YOU WON' : `GAME OVER · ${dateLabel(s.month).toUpperCase()}`}`, PAD, y);
  c.letterSpacing = '0px';
  y += 60;

  c.font = `700 104px ${SERIF}`;
  c.fillStyle = s.status === 'ww3' ? C.bad : s.status === 'depression' ? C.blue : C.gold2;
  y = para(c, ENDINGS[s.status], PAD, y, INNER, 110) + 22;

  c.font = `30px ${SANS}`;
  c.fillStyle = C.muted;
  c.fillText('History will call you', PAD, y);
  y += 46;
  c.font = `700 54px ${SERIF}`;
  c.fillStyle = C.text;
  y = para(c, legacyTitle(s).title, PAD, y, INNER, 64) + 34;

  // The post, laid out like one.
  const inset = 40;
  c.font = `34px ${SANS}`;
  const lines = wrap(c, post, INNER - inset * 2);
  const postHeight = inset + 72 + 30 + lines.length * 48 + inset - 10;
  box(c, PAD, y, INNER, postHeight, 20, C.panel2, C.line);

  const avatarX = PAD + inset + 36;
  const avatarY = y + inset + 36;
  const shine = c.createLinearGradient(0, avatarY - 36, 0, avatarY + 36);
  shine.addColorStop(0, C.gold2);
  shine.addColorStop(1, C.gold);
  c.beginPath();
  c.arc(avatarX, avatarY, 36, 0, Math.PI * 2);
  c.fillStyle = shine;
  c.fill();
  c.font = `700 44px ${SERIF}`;
  c.fillStyle = C.goldInk;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('★', avatarX, avatarY + 2);
  c.textAlign = 'left';
  c.textBaseline = 'top';

  const nameX = avatarX + 36 + 22;
  c.font = `700 32px ${SANS}`;
  c.fillStyle = C.text;
  c.fillText('The President', nameX, y + inset + 2);
  const tickX = nameX + c.measureText('The President').width + 26;
  const tickY = y + inset + 20;
  c.beginPath();
  c.arc(tickX, tickY, 14, 0, Math.PI * 2);
  c.fillStyle = C.blue;
  c.fill();
  c.beginPath();
  c.moveTo(tickX - 6, tickY);
  c.lineTo(tickX - 1.5, tickY + 5);
  c.lineTo(tickX + 6.5, tickY - 5);
  c.strokeStyle = C.panel2;
  c.lineWidth = 3.5;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
  c.font = `26px ${SANS}`;
  c.fillStyle = C.muted;
  c.fillText('@StableGenius · 3:07 AM', nameX, y + inset + 42);

  c.font = `34px ${SANS}`;
  c.fillStyle = C.text;
  let lineY = y + inset + 72 + 30;
  for (const line of lines) {
    c.fillText(line, PAD + inset, lineY);
    lineY += 48;
  }
  y += postHeight + 30;

  // The score gets a tile to itself; the rest sit two to a row.
  const stats = finalStats(s);
  const total = stats.pop()!;
  box(c, PAD, y, INNER, 150, 12, C.panel2, C.gold);
  c.font = `600 25px ${SANS}`;
  c.fillStyle = C.muted;
  c.letterSpacing = '4px';
  c.fillText(total.label.toUpperCase(), PAD + 28, y + 26);
  c.letterSpacing = '0px';
  c.font = `700 76px ${SERIF}`;
  c.fillStyle = C.gold2;
  c.fillText(total.value, PAD + 28, y + 62);
  y += 150 + 20;

  const gap = 20;
  const tileHeight = 116;
  stats.forEach((stat, i) => {
    const alone = i === stats.length - 1 && i % 2 === 0;
    const tileWidth = alone ? INNER : (INNER - gap) / 2;
    const x = PAD + (i % 2) * (tileWidth + gap);
    const top = y + Math.floor(i / 2) * (tileHeight + gap);
    box(c, x, top, tileWidth, tileHeight, 10, C.panel2);
    c.font = `24px ${SANS}`;
    c.fillStyle = C.muted;
    c.fillText(stat.label, x + 24, top + 18);
    c.font = `44px ${SERIF}`;
    c.fillStyle = C.gold2;
    c.fillText(stat.value, x + 24, top + 54);
  });
  y += Math.ceil(stats.length / 2) * (tileHeight + gap) + 30;

  c.textAlign = 'center';
  c.font = `30px ${SANS}`;
  c.fillStyle = C.muted;
  c.fillText('Think you can do better? Play free at', W / 2, y);
  y += 46;
  c.font = `700 50px ${SERIF}`;
  c.fillStyle = C.gold2;
  c.fillText(SITE_URL.replace('https://', ''), W / 2, y);
  y += 62;

  return y + 84;
}

/** The ending screen as a PNG. */
export function renderCard(s: GameState, post: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 8;
  const height = paint(canvas.getContext('2d')!, s, post, 8);
  canvas.height = height;
  paint(canvas.getContext('2d')!, s, post, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the image.'))), 'image/png');
  });
}

const enc = encodeURIComponent;

/** Where the post can go. Facebook takes no pre-written text, so there the text is what gets copied. */
const NETWORKS: { name: string; copies: 'image' | 'text'; href: (post: string) => string }[] = [
  { name: 'X', copies: 'image', href: (post) => `https://twitter.com/intent/tweet?text=${enc(post)}&url=${enc(SITE_URL)}` },
  { name: 'Facebook', copies: 'text', href: () => `https://www.facebook.com/sharer/sharer.php?u=${enc(SITE_URL)}` },
  { name: 'Truth Social', copies: 'image', href: (post) => `https://truthsocial.com/share?text=${enc(post)}&url=${enc(SITE_URL)}` },
  { name: 'Bluesky', copies: 'image', href: (post) => `https://bsky.app/intent/compose?text=${enc(`${post} ${SITE_URL}`)}` },
];

export function Brag({ state }: { state: GameState }) {
  const post = useMemo(() => bragPost(state), [state]);
  const [card, setCard] = useState<{ file: File; url: string } | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    let live = true;
    let url = '';
    renderCard(state, post).then(
      (blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setCard({ file: new File([blob], FILE_NAME, { type: 'image/png' }), url });
      },
      () => {
        // No canvas, no picture. The text can still be posted.
      },
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [state, post]);

  const full = `${post} ${SITE_URL}`;
  const canShareImage = useMemo(() => {
    try {
      return Boolean(card && navigator.canShare?.({ files: [card.file] }));
    } catch {
      return false;
    }
  }, [card]);

  const copyImage = (): Promise<void> => {
    if (!card || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return Promise.reject(new Error('unsupported'));
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': card.file })]);
  };
  const copyText = (): Promise<void> => navigator.clipboard?.writeText?.(full) ?? Promise.reject(new Error('unsupported'));

  const postTo = (network: (typeof NETWORKS)[number]) => {
    // The copy has to start before the new tab takes the focus away.
    const copied = network.copies === 'image' ? copyImage() : copyText();
    window.open(network.href(post), '_blank', 'noopener,noreferrer');
    copied.then(
      () =>
        setNote(
          network.copies === 'image'
            ? `Image copied. Paste it into your ${network.name} post to show them the numbers.`
            : `Your post is copied. Paste it into ${network.name}, then save the image and attach it.`,
        ),
      () => setNote(`Save the image and attach it to your ${network.name} post.`),
    );
  };

  const shareSheet = async () => {
    if (!card) return;
    try {
      await navigator.share({ files: [card.file], text: full });
    } catch {
      // Closed without sharing.
    }
  };

  return (
    <section className="brag">
      <h2>Brag about it</h2>
      <blockquote className="brag-post">
        {post} <span className="brag-link">{SITE_URL.replace('https://', '')}</span>
      </blockquote>
      {card && <img className="brag-card" src={card.url} alt="Your final stats as an image, ready to post." />}
      <div className="row">
        {canShareImage && (
          <button className="btn primary" onClick={shareSheet}>
            Share image
          </button>
        )}
        {NETWORKS.map((network) => (
          <button key={network.name} className="btn" onClick={() => postTo(network)}>
            {network.name}
          </button>
        ))}
      </div>
      <div className="row">
        {card && (
          <a className="btn" href={card.url} download={FILE_NAME}>
            Save image
          </a>
        )}
        <button
          className="btn"
          onClick={() =>
            copyImage().then(
              () => setNote('Image copied. Paste it anywhere.'),
              () => setNote('This browser cannot copy images. Save it instead.'),
            )
          }
          disabled={!card}
        >
          Copy image
        </button>
        <button
          className="btn"
          onClick={() =>
            copyText().then(
              () => setNote('Post copied, link and all.'),
              () => setNote('This browser would not copy the text. Select it above instead.'),
            )
          }
        >
          Copy text
        </button>
      </div>
      <p className="fine" role="status">
        {note || 'Share links carry the words but not the picture. Pick a network and the image is copied for you: paste it into the post.'}
      </p>
    </section>
  );
}
