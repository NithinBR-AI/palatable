import type { RawMessage } from "@/lib/extract/anchors";
import type { Participant } from "@/lib/schema/state";

export const WEEKENDWARRIORS_ID = "eval-group-ww";

export const WEEKENDWARRIORS_PARTICIPANTS: Participant[] = [
  { id: "p-jordan", name: "Jordan", tasteAnchors: [] },
  { id: "p-maya",   name: "Maya",   tasteAnchors: [] },
  { id: "p-kai",    name: "Kai",    tasteAnchors: [] },
];

function msg(id: string, participantId: string, participantName: string, text: string, timestamp: string): RawMessage {
  return { participantId, participantName, text, timestamp };
}

export const WEEKENDWARRIORS_MESSAGES: RawMessage[] = [
  // Week 1 — music and film
  msg("m001", "p-jordan", "Jordan", "anyone else been deep in Daft Punk's Discovery lately? put it on during my run this morning and didn't stop until I'd done 14km", "2026-09-01T08:30:00Z"),
  msg("m002", "p-maya",   "Maya",   "lol yes, also Random Access Memories is the superior album and I'll die on that hill", "2026-09-01T08:45:00Z"),
  msg("m003", "p-kai",    "Kai",    "both correct, also Homework is criminally underrated", "2026-09-01T08:50:00Z"),
  msg("m004", "p-jordan", "Jordan", "saw the Wes Anderson retrospective at the ICA last weekend, Grand Budapest is still his best but Isle of Dogs hit different on the big screen", "2026-09-02T11:00:00Z"),
  msg("m005", "p-kai",    "Kai",    "jealous, I was trying to get tickets. ended up watching The French Dispatch at home instead", "2026-09-02T11:15:00Z"),
  msg("m006", "p-maya",   "Maya",   "I can't do Wes Anderson marathons anymore without wanting to completely redecorate my flat", "2026-09-02T11:20:00Z"),

  // Week 2 — food and culture
  msg("m007", "p-kai",    "Kai",    "found a new ramen spot that is genuinely life changing. tonkotsu, 18 hour broth, they only do 40 bowls a day", "2026-09-08T13:00:00Z"),
  msg("m008", "p-jordan", "Jordan", "address NOW please", "2026-09-08T13:02:00Z"),
  msg("m009", "p-kai",    "Kai",    "sending it, but also: Thundercat is touring. I already bought three tickets. who's in", "2026-09-08T13:05:00Z"),
  msg("m010", "p-maya",   "Maya",   "obviously yes. also I finally went to the Solange exhibit and it was one of the best things I've experienced this year honestly", "2026-09-09T10:00:00Z"),
  msg("m011", "p-jordan", "Jordan", "I watched the Anthony Bourdain No Reservations Japan episode again last night and now I need to go to Japan immediately", "2026-09-09T21:00:00Z"),
  msg("m012", "p-kai",    "Kai",    "same energy every time I watch it. he had this thing where he'd find one perfect bowl of something and just sit with it", "2026-09-09T21:10:00Z"),
  msg("m013", "p-maya",   "Maya",   "been deep in Monocle this week reading about cities that actually invest in public spaces and culture. making me want to move somewhere new", "2026-09-10T09:00:00Z"),

  // Week 3 — craft beer and planning intent
  msg("m014", "p-jordan", "Jordan", "went to this craft brewery tap room in Bermondsey on Saturday, they do these wild sour ales with local fruit, really special atmosphere", "2026-09-15T12:00:00Z"),
  msg("m015", "p-kai",    "Kai",    "I need this in my life. also can we talk about going somewhere? I feel like we've been saying 'we should plan a trip' for six months", "2026-09-15T12:10:00Z"),
  msg("m016", "p-maya",   "Maya",   "100%, I want somewhere with a real contemporary art scene, not just one famous museum. and good food obviously", "2026-09-15T12:15:00Z"),
  msg("m017", "p-jordan", "Jordan", "and ramen. Kai's conditions are non-negotiable at this point", "2026-09-15T12:17:00Z"),
  msg("m018", "p-kai",    "Kai",    "correct. ok seriously let's actually plan this. where should we go", "2026-09-15T12:20:00Z"),
];

export const WEEKENDWARRIORS_TRIGGER: RawMessage = {
  participantId: "p-jordan",
  participantName: "Jordan",
  text: "where should we go for our next trip? let Palatable decide",
  timestamp: "2026-09-15T12:25:00Z",
};
