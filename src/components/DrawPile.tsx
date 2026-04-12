interface DrawPileProps {
  count: number;
}

const DrawPile = ({ count }: DrawPileProps) => {
  const visibleCards =
    count > 20 ? 4 : count > 10 ? 3 : count > 5 ? 2 : count > 0 ? 1 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          position: "relative",
          width: 80 + (visibleCards > 0 ? (visibleCards - 1) * 2 : 0),
          height: 112 + (visibleCards > 0 ? (visibleCards - 1) * 2 : 0),
        }}
      >
        {visibleCards === 0 ? (
          <div
            style={{
              width: 80,
              height: 112,
              borderRadius: 6,
              border: "2px dashed #231f2033",
            }}
          />
        ) : (
          Array.from({ length: visibleCards }).map((_, i) => (
            <img
              key={i}
              src="/cards/Card Back.svg"
              alt="Card back"
              style={{
                position: "absolute",
                top: (visibleCards - 1 - i) * 2,
                left: (visibleCards - 1 - i) * 2,
                width: 80,
                height: 112,
                borderRadius: 6,
                boxShadow: i === visibleCards - 1 ? "2px 3px 6px rgba(0,0,0,0.2)" : "1px 1px 3px rgba(0,0,0,0.1)",
              }}
            />
          ))
        )}
      </div>
      <span style={{ fontSize: 14, color: "#231f20", opacity: 0.5, fontStyle: "italic" }}>
        {count} cards
      </span>
    </div>
  );
};

export default DrawPile;
