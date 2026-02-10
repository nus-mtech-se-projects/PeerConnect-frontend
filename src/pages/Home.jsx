import Carousel from "../components/Carousel";
import FeatureCard from "../components/FeatureCard";
import tutoringImg from "../assets/images/tutoring.jpg";
import studyGroupImg from "../assets/images/study-group.jpg";
import chatBotImg from "../assets/images/chatbot.jpg";
import supportSystemImg from "../assets/images/support-system.jpg";
export default function Home() {
   const slides = [
    {
      title: "Find the right tutor",
      description: "Match with peers who have aced the same module.",
      imageSrc: tutoringImg,
      imageAlt: "Peer tutoring session",
    },
    {
      title: "Join study rooms",
      description: "Create or join groups that keep you consistent.",
      imageSrc: studyGroupImg,
      imageAlt: "Students in a study group",
    },
    {
      title: "Ask AI anytime",
      description: "Instant explanations with examples and practice.",
      imageSrc: chatBotImg,
      imageAlt: "AI chatbot assistance",
    },
      {
      title: "Support Groups",
      description: "Get accountability, encouragement, and guidance from peers.",
      imageSrc: supportSystemImg,
      imageAlt: "Students in a supportive group discussion",
    },
  ];

  const features = [
    { title: "Peer tutoring system", desc: "Book 1:1 sessions with peer tutors who know your module." },
    { title: "Study Groups", desc: "Collaborative learning rooms with shared goals and schedules." },
    { title: "AI Chatbot", desc: "Instant explanations, examples, and revision questions." },
    { title: "Support System", desc: "Help center, FAQs, and assistance when you get stuck." },
  ];

  return (
    <div className="page">
      <Carousel slides={slides} autoPlayMs={0} />

      <section className="featureRow">
        {features.map((f) => (
          <FeatureCard key ={f.title} title={f.title} description={f.desc}/>
        ))}
      </section>
    </div>
  );
}
