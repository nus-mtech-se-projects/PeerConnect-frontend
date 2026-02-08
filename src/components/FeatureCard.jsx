export default function FeatureCard({ title, description }) {
  return (
    <article className="featureCard">
      <div className="featureCardTitle">{title}</div>
      <div className="featureCardDesc">{description}</div>
    </article>
  );
}