import { VALUES } from "@/lib/constants";

export default function ValuesStrip() {
  return (
    <div className="values">
      {VALUES.map((v) => (
        <div className="value" key={v.i}>
          <span className="vi">{v.i}</span>
          <h4>{v.h}</h4>
          <p>{v.p}</p>
        </div>
      ))}
    </div>
  );
}
