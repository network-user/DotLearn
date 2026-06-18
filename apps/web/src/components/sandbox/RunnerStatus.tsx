interface RunnerStatusProps {
  message: string;
}

export const RunnerStatus = ({ message }: RunnerStatusProps) => (
  <div role="status" aria-live="polite" className="sr-only">
    {message}
  </div>
);
