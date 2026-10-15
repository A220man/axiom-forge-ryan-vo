export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div className="loading-state" style={{ width: size, height: size }}>
      <div
        className="spinner"
        style={{ width: size, height: size, borderWidth: Math.max(2, size / 12) }}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}