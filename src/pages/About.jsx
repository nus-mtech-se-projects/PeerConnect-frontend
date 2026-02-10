import React from "react";
import tutoringImg from "../assets/images/tutoring.jpg";
function Block({ title, children }) {
  return (
    <section className="infoBlock">
      <div className="infoTitle">{title}</div>
      <div className="infoBody">{children}</div>
    </section>
  );
}

export default function About() {
  return (
    <div className="page">
      <div className="twoCol">
        <div>
          <Block title="Who are we?">
            PeerConnect is a peer-tutoring portal that helps students learn faster by connecting them
            with the right peers, study groups, and support tools.
          </Block>

          <Block title="Why we created this portal?">
            We built PeerConnect to make help accessible—whether you prefer 1:1 tutoring, group
            revision, or quick AI-assisted explanations.
          </Block>

          <Block title="Contact us">
            <div className="contactLine">Email: support@peerconnect.example</div>
            <div className="contactLine">Hours: Mon–Fri, 9am–6pm</div>
          </Block>
        </div>

        <div className="rightPlaceholder">
          <img className="aboutImg" src={tutoringImg} alt="Peer tutoring session" />
        </div>

      </div>
    </div>
  );
}
