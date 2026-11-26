import { MASTHEAD } from './game/paper.ts';
import type { FrontPage, Story } from './game/paper.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const when = (story: Story) => MONTHS[(story.month - 1) % 12];

/** The year-end paper: one big story, a few smaller ones, and the numbers. */
export function Newspaper({ paper, onFold }: { paper: FrontPage; onFold?: () => void }) {
  const { lead } = paper;
  return (
    <article className="paper" aria-label={`${MASTHEAD}, ${paper.dateline}`}>
      <header className="paper-head">
        <div className="paper-ears">
          <span>{paper.price}</span>
          <span>Weather: {paper.weather}</span>
        </div>
        <h2 className="paper-masthead">{MASTHEAD}</h2>
        <p className="paper-dateline">
          {paper.dateline} · {paper.final ? 'The Term In Review' : `Year ${paper.year} In Review`}
        </p>
      </header>

      {lead ? (
        <section className={`paper-lead tone-${lead.tone}`}>
          <p className="paper-kicker">
            {lead.kicker} · {when(lead)}
          </p>
          <h3>{lead.headline}</h3>
          <p>{lead.text}</p>
        </section>
      ) : (
        <section className="paper-lead">
          <h3>Nothing Happened, Officially</h3>
          <p>The White House press office declined to describe the year, on the grounds that it is still going on.</p>
        </section>
      )}

      <div className="paper-body">
        <div className="paper-columns">
          {paper.others.map((story) => (
            <section key={`${story.month}-${story.headline}`} className="paper-story">
              <p className="paper-kicker">
                {story.kicker} · {when(story)}
              </p>
              <h4>{story.headline}</h4>
              <p>{story.text}</p>
            </section>
          ))}
        </div>
        <aside className="paper-side">
          <h4>The Year In Numbers</h4>
          <dl>
            {paper.numbers.map((n) => (
              <div key={n.label}>
                <dt>{n.label}</dt>
                <dd>{n.value}</dd>
              </div>
            ))}
          </dl>
          <h4>Editorial</h4>
          <p className="paper-ed-head">{paper.editorial.headline}</p>
          <p>{paper.editorial.text}</p>
          <h4>Corrections</h4>
          <p className="paper-correction">{paper.correction}</p>
        </aside>
      </div>

      {onFold && (
        <button className="btn primary paper-fold" onClick={onFold}>
          {paper.reply}
        </button>
      )}
    </article>
  );
}
