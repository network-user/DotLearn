import { useState } from 'react';

import { Link, useNavigate } from '@tanstack/react-router';

export const AddTopicButton = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const goSubmit = () => {
    setOpen(false);
    navigate({ to: '/submit' });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-500 hover:bg-indigo-400 text-white shadow-sm"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        + Add topic
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl p-2"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={goSubmit}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-800"
          >
            <div className="text-sm font-medium text-zinc-100">Suggest a topic</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Fill a short form. Goes to the maintainer queue for review.
            </div>
          </button>
          <Link
            to="/"
            className="block px-3 py-2 rounded-md hover:bg-zinc-800"
            onClick={() => setOpen(false)}
          >
            <a
              href="https://github.com/your-org/dotlearn/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noreferrer"
              className="block"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="text-sm font-medium text-zinc-100">Open a Pull Request</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Use the lesson-forge skill locally, then push and open a PR.
              </div>
            </a>
          </Link>
        </div>
      ) : null}
    </div>
  );
};
