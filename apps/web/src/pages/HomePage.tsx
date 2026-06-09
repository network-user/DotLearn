import { Link } from '@tanstack/react-router';

import { listTopics } from '@/lib/topics';

export const HomePage = () => {
  const topics = listTopics();

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Your learning workbench</h1>
        <p className="mt-3 text-zinc-400 max-w-2xl">
          DotLearn is a local-first platform where each topic is a self-contained, type-safe module.
          Generate new topics with the <code className="text-indigo-300">lesson-forge</code> Cursor
          skill, study them in the browser, fork the repo and ask your own agent for a personal
          curriculum.
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-semibold">Topics</h2>
          <span className="text-sm text-zinc-500">{topics.length} loaded</span>
        </div>
        {topics.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topics.map((topic) => (
              <li key={topic.slug}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: topic.slug }}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900 transition p-5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-zinc-100">{topic.title}</h3>
                    <span className="text-xs uppercase tracking-wide text-zinc-500">
                      {topic.difficulty}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    {topic.concepts.length} concepts · ~{topic.estimatedHours}h · {topic.runtime}
                  </p>
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const EmptyState = () => (
  <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
    <h3 className="font-medium text-zinc-200">No topics yet</h3>
    <p className="mt-1 text-sm text-zinc-400">
      Ask Cursor in this repo:{' '}
      <span className="text-indigo-300">«Use lesson-forge, add a topic on SQL»</span>.
    </p>
  </div>
);
