University students face increasing academic pressure, fragmented peer support, and limited access to timely academic and psychological assistance. While peer tutoring and study groups are proven to improve learning outcomes, existing solutions are often informal, poorly coordinated, and disconnected from institutional data.

The objective of PeerConnect is to address this problem by providing a centralized, secure, and intelligent peer tutoring platform tailored to the NUS academic ecosystem and Singapore’s education context. The platform enables students to self-organize into study groups and access AI-powered academic assistance. A simple forum enables students to share ideas, ask questions, and discuss challenges with their peers. It supports quick, collaborative problem‑solving within the community and obtains well-being and psychological support resources, while integrating with the NUS Student Database for authentication and contextual personalization.

This project serves as a practical vehicle to demonstrate end-to-end software engineering competencies, including Agile development, requirements analysis, architectural design, application of design patterns, DevSecOps practices, and automated delivery pipelines.

General Architecture
The system adopts a modular monolithic architecture, balancing simplicity with clear internal separation of concerns. This approach is suitable for the project's scope while enabling future evolution into microservices if required.
  
 Logical Architecture Components:

1. Presentation Layer – Web-based UI for students and administrators

2. Application Layer – Authentication, study group management, peer tutoring, AI tutor, support and administration modules

3. Domain Layer – Core business logic, domain models, and validation rules

4. Data Access Layer – Persistence logic and external system integrations

5. Infrastructure Layer – CI/CD pipeline, security, logging, and monitoring

Functional Requirements
Key Use Cases:

Student Authentication and Profile Management

System will allow for registration via email or phone verification.

Ability to the system Login and Logout.

System will allow for updated profile management and reset password / account recovery support.

The system will allow users to be able to give feedback from other peers like ex: On time / punctuality, Hands-on materials, Quality of explanation, Comprehensive documentation, Communication skills. Rating displayed as aggregated scores (not raw comments only) to ensure fairness.

The system will be able to join / leave groups, see upcoming activities, or receive notifications for group updates.

System will allow users to give other user feedback, rating or block other peer members, so that any activity from the blocked user will not be visible or ability to attend in the groups.


Self-Organizing Study Groups 

This module enables students to independently create, discover, and join study groups aligned to their courses, academic needs, and schedules. It facilitates structured peer collaboration while ensuring alignment with NUS academic data and secure access.

The system will allow students to create study groups by specifying course code, topic, preferred study mode (online or in-person), location, and time availability.

The system will allow students to discover and join existing study groups based on filters such as course code, study topic, and schedule.

The system will integrate with NUS student profile data to recommend relevant study groups based on a student’s registered courses.

The system will allow group creators to define group size limits and manage membership (approve, remove, or assign roles such as admin or member).

The system will provide basic group communication features, including group announcements and discussion threads.

The system will support scheduling of study sessions and notify group members of upcoming sessions.

The system will allow students to leave or dissolve study groups, with appropriate notifications to remaining members.

 

Peer Tutoring System

This module will enable students who are highly performing to help their peers who require more guidance, apart from their teachers, either because of poor grades, or maybe just require more help to improve their studies. This system would involve numerous ways for students to tutor their peers, such as prerecorded lessons, one-on-one, and group lessons.

This feature will allow users to create classes on the platform for other classmates to sign up for. 

Users would be able to sign up for both one-on-one classes or group classes

It will be conducted in an online platform similar to zoom or Microsoft teams.

Lessons can be recorded for later use or prerecorded and posted as courses for other students to sign up similar to the format of online platforms like Udemy or Coursera.

Peer tutoring can extend to personal time, where they would be able to contact their peer tutors in their free time using a chat feature

Users will be able to manage courses created, or they have signed up for, through a user interface that would be adjusted based on whether you are a tutor or a tutee.

  

 AI Tutor

This feature provides supplementary academic assistance to students by using an AI-powered conversational tutor for course-related queries at any time without waiting for peers’ availability.

Ai tutor will be able to answer common questions that students will usually ask

Similar to modern AI Chatbots like ChatGPT and Google Gemini, but more catered to the school syllabus

 

Support System (Psychology and Well-being)

The system will provide access to curated well-being and mental health resources relevant to university students.

The system will integrate official NUS counseling services and trusted external support links in Singapore.

The system will clearly distinguish peer academic support from professional psychological services through disclaimers.

The system will provide crisis escalation information, including emergency and hotline contacts.

The development of this module will be delivered incrementally using Agile–Scrum, with user stories prioritized based on student needs.

The module will be developed, tested, and integrated collaboratively within the team during sprint iterations.

 

Non-Functional Requirements

Performance

PeerConnect shall provide responsive and efficient system performance, ensuring that common user actions such as login, group discovery, and content access are completed within acceptable response times. Real-time features such as chat and online tutoring shall operate smoothly without noticeable lag.

System should be able to handle at least 1000 concurrent users, with response times no more than 5 seconds.

 

Availability & Reliability

The system shall be highly available and reliable to support students’ academic needs at any time. Core services shall remain operational even if non-critical components (e.g., AI Tutor or external integrations) are temporarily unavailable.

System should have minimally 95% uptime, with a predictable maintenance window of around 8 hours per week.

 

Security

PeerConnect shall implement strong security controls to protect student data and platform integrity. Authentication, authorization, and access control mechanisms shall ensure that only authorized users can access system features, while protecting against common security threats.

PeerConnect shall follow modern DevSecOps practices, including automated testing, secure build pipelines, and controlled deployment across development, staging, and production environments.

 

Privacy & Data Protection

The system shall respect user privacy and data protection regulations applicable in Singapore and NUS. Personal data shall be handled securely, with minimal data exposure and clear separation between academic peer support and professional psychological services.

 

Scalability

PeerConnect shall be designed to scale with increasing user demand, supporting future growth in student population, study groups, and tutoring sessions without requiring major architectural changes.

 

Usability & Accessibility

The system shall offer a user-friendly and accessible interface that enables students to easily discover groups, participate in tutoring, and access support resources. The platform shall be usable across common devices and browsers.