import { Link, useParams } from '@tanstack/react-router';

import { getTopic } from '@/lib/topics';

export const TopicPage = () => {
  const { slug } = useParams({ from: '/topics/$slug' });
  const topic = getTopic(slug);

  if (!topic) {
    return (
      <div className="rounded-xl border border-zinc-800 p-8 text-center">
        <h2 className="font-semibold text-zinc-100">Topic not found</h2>
        <p className="mt-2 text-sm text-zinc-400">No topic with slug “{slug}”.</p>
        <Link to="/" className="inline-block mt-4 text-indigo-300 hover:text-indigo-200">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <article className="space-y-8">
      <header>
        <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wide">
          <span>{topic.difficulty}</span>
          <span>·</span>
          <span>{topic.runtime}</span>
          <span>·</span>
          <span>~{topic.estimatedHours}h</span>
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{topic.title}</h1>
        <div className="mt-3 flex flex-wrap gap-1">
          {topic.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] uppercase tracking-wide text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>
      <section>
        <h2 className="text-lg font-semibold mb-3">Curriculum</h2>
        <ol className="space-y-2">
          {topic.concepts.map((concept, index) => (
            <li
              key={concept.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-100">
                  {index + 1}. {concept.title}
                </span>
                <span className="text-xs text-zinc-500">~{concept.estimatedMinutes} min</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {concept.theoryFiles.length} theory · {concept.exerciseFiles.length} exercise set
                {concept.exerciseFiles.length === 1 ? '' : 's'}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-zinc-500">
          Theory + exercise rendering is the next milestone (Phase 1 — see ROADMAP).
        </p>
      </section>
    </article>
  );
};
