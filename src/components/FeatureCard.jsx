import PropTypes from "prop-types";

export default function FeatureCard({ title, description }) {
  return (
    <article className="featureCard">
      <div className="featureCardTitle">{title}</div>
      <div className="featureCardDesc">{description}</div>
    </article>
  );
}

FeatureCard.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
};