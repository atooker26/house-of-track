export default function Lanes() {
  const lanes = [
    { top: 18, width: "46%", label: "Share" },
    { top: 58, width: "68%", label: "Connect" },
    { top: 98, width: "calc(100% - 80px)", label: "Inspire" },
  ];

  return (
    <div className="lanes">
      {lanes.map(({ top, width, label }) => (
        <div key={label}>
          <div className="lane" style={{ top, width }} />
          <div className="lane-word" style={{ top, left: width }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
