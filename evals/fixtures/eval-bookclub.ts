import type { RawMessage } from "@/lib/extract/anchors";
import type { Participant } from "@/lib/schema/state";

export const BOOKCLUB_ID = "eval-group-bc";

export const BOOKCLUB_PARTICIPANTS: Participant[] = [
  { id: "p-priya", name: "Priya", tasteAnchors: [] },
  { id: "p-tom",   name: "Tom",   tasteAnchors: [] },
  { id: "p-aisha", name: "Aisha", tasteAnchors: [] },
  { id: "p-lena",  name: "Lena",  tasteAnchors: [] },
];

export const BOOKCLUB_MESSAGES: RawMessage[] = [
  // Week 1 — literature and music
  {
    participantId: "p-priya",
    participantName: "Priya",
    text: "finished Kafka on the Shore last night at 1am and now I can't think about anything else. Murakami does something to your brain that no other writer does",
    timestamp: "2026-09-01T09:00:00Z",
  },
  {
    participantId: "p-tom",
    participantName: "Tom",
    text: "Norwegian Wood is still my favourite — more grounded but same uncanny pull. I actually had Kind of Blue playing while I read it, which felt right",
    timestamp: "2026-09-01T09:15:00Z",
  },
  {
    participantId: "p-aisha",
    participantName: "Aisha",
    text: "I can't read without music either. been going deep into Fela Kuti's Afrobeat catalogue — Zombie especially. the polyrhythm just opens something up in the brain",
    timestamp: "2026-09-01T09:30:00Z",
  },
  {
    participantId: "p-lena",
    participantName: "Lena",
    text: "I've been on a Nick Cave spiral. The Death of Bunny Munro is genuinely disturbing in the best way. dark and literary and completely its own thing",
    timestamp: "2026-09-01T09:45:00Z",
  },
  {
    participantId: "p-priya",
    participantName: "Priya",
    text: "Nick Cave's lyrics are basically poetry. I went to see him at the Barbican two years ago and it was one of the most intense live experiences of my life",
    timestamp: "2026-09-01T10:00:00Z",
  },

  // Week 2 — film and visual culture
  {
    participantId: "p-aisha",
    participantName: "Aisha",
    text: "rewatched In the Mood for Love last night. Wong Kar-wai's cinematography is just incomparable — every frame is a painting. I don't understand how he shot it",
    timestamp: "2026-09-05T20:00:00Z",
  },
  {
    participantId: "p-priya",
    participantName: "Priya",
    text: "the Criterion Collection just dropped three new films and I have already cancelled my weekend plans. they pick such strange and perfect things",
    timestamp: "2026-09-06T10:00:00Z",
  },
  {
    participantId: "p-tom",
    participantName: "Tom",
    text: "went to Tate Modern on Saturday — the Louise Bourgeois retrospective is extraordinary. stayed for three hours and didn't realise. David Bowie's connection to that whole art world always interests me, how music and visual art overlap",
    timestamp: "2026-09-07T14:00:00Z",
  },
  {
    participantId: "p-lena",
    participantName: "Lena",
    text: "I've been in a dark academia spiral this week. found this independent bookshop near Holborn with a basement full of mid-century Penguin paperbacks. felt like the set of a film",
    timestamp: "2026-09-08T15:00:00Z",
  },
  {
    participantId: "p-aisha",
    participantName: "Aisha",
    text: "there's a street food market near me that does incredible West African food — kelewele, suya, fresh coconut rice. I love how food tells the same story as music, just in a different language",
    timestamp: "2026-09-08T18:00:00Z",
  },

  // Week 3 — travel longing and planning intent
  {
    participantId: "p-tom",
    participantName: "Tom",
    text: "had a natural wine from a small Georgian producer last night — amber wine, totally cloudy, tasted like dried apricots and dried flowers. changed how I think about wine. makes me want to go somewhere I've never been",
    timestamp: "2026-09-10T19:00:00Z",
  },
  {
    participantId: "p-lena",
    participantName: "Lena",
    text: "I am done with beach holidays, I need somewhere with old bookshops and a serious literary culture. the kind of city where you find handwritten notes tucked inside second-hand books",
    timestamp: "2026-09-11T11:00:00Z",
  },
  {
    participantId: "p-priya",
    participantName: "Priya",
    text: "yes — somewhere with jazz bars where people actually listen. not background music, proper listening rooms. Tokyo has those, also some European cities",
    timestamp: "2026-09-11T11:20:00Z",
  },
  {
    participantId: "p-aisha",
    participantName: "Aisha",
    text: "I want street food that tells you something about where you are, not tourist-facing stuff. and a good independent cinema showing films you can't find on streaming",
    timestamp: "2026-09-11T11:35:00Z",
  },
  {
    participantId: "p-tom",
    participantName: "Tom",
    text: "this group could genuinely go anywhere and find something meaningful. we should actually do it. let's pick somewhere properly instead of just saying we should",
    timestamp: "2026-09-11T11:50:00Z",
  },
];

export const BOOKCLUB_TRIGGER: RawMessage = {
  participantId: "p-lena",
  participantName: "Lena",
  text: "seriously though where should the four of us go, I want somewhere with depth not just Instagram spots",
  timestamp: "2026-09-12T10:00:00Z",
};
