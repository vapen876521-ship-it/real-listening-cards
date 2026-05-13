type BadgeProps = {
  children: React.ReactNode;
  tone?: "default" | "green" | "blue" | "amber";
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
