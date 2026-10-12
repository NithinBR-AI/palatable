import type { MessageRecord, GroupRecord } from "@/lib/db/schema";
import type { RawMessage } from "@/lib/extract/anchors";

export const LUXURY_GROUP: GroupRecord = {
  groupId: "group-demo-003",
  name: "The Luxury Minimalists",
  participants: ["p-claire", "p-james", "p-sofia", "p-ravi", "p-eve"],
  createdAt: "2026-09-01T10:00:00Z",
};

export const LUXURY_PARTICIPANTS = [
  { id: "p-claire", name: "Claire", avatar: "C", color: "#a855f7" },
  { id: "p-james",  name: "James",  avatar: "J", color: "#0ea5e9" },
  { id: "p-sofia",  name: "Sofia",  avatar: "S", color: "#f43f5e" },
  { id: "p-ravi",   name: "Ravi",   avatar: "R", color: "#10b981" },
  { id: "p-eve",    name: "Eve",    avatar: "E", color: "#f59e0b" },
];

function msg(
  id: string,
  participantId: string,
  participantName: string,
  text: string,
  timestamp: string,
): MessageRecord {
  return {
    groupId: "group-demo-003",
    sortKey: `${timestamp}#${id}`,
    participantId,
    participantName,
    text,
    timestamp,
    processed: false,
  };
}

export const LUXURY_MESSAGES: MessageRecord[] = [
  // Week 1
  msg("l001", "p-claire", "Claire", "just finished reading the new Ottolenghi book cover to cover. already planning which recipes I'm testing this weekend", "2026-09-02T09:00:00Z"),
  msg("l002", "p-james",  "James",  "his Jerusalem book changed how I cook entirely. genuinely formative", "2026-09-02T09:10:00Z"),
  msg("l003", "p-sofia",  "Sofia",  "I need to get into cooking properly. all I do is find good restaurants instead", "2026-09-02T09:15:00Z"),
  msg("l004", "p-ravi",   "Ravi",   "both are valid life strategies honestly", "2026-09-02T09:20:00Z"),
  msg("l005", "p-eve",    "Eve",    "cooking IS finding good restaurants. you shop at the same places", "2026-09-02T09:22:00Z"),
  msg("l006", "p-claire", "Claire", "has anyone dealt with the new building management? they changed the entry code again", "2026-09-02T10:00:00Z"),
  msg("l007", "p-ravi",   "Ravi",   "yes I got an email, check your inbox from yesterday", "2026-09-02T10:05:00Z"),
  msg("l008", "p-sofia",  "Sofia",  "found it, thank you", "2026-09-02T10:07:00Z"),

  msg("l009", "p-james",  "James",  "went to Nobu last night for a client dinner. still one of the best rooms in the city", "2026-09-03T11:00:00Z"),
  msg("l010", "p-claire", "Claire", "agreed on the room. Aesop store nearby is also beautiful if you haven't been, proper design object", "2026-09-03T11:10:00Z"),
  msg("l011", "p-sofia",  "Sofia",  "I can't walk past an Aesop without going in, it's a problem", "2026-09-03T11:15:00Z"),
  msg("l012", "p-ravi",   "Ravi",   "same. it's aspirationally minimalist in a way I want my entire life to be", "2026-09-03T11:20:00Z"),
  msg("l013", "p-eve",    "Eve",    "their Marrakech hand wash is the only scent that matters", "2026-09-03T11:25:00Z"),
  msg("l014", "p-james",  "James",  "strong take", "2026-09-03T11:27:00Z"),
  msg("l015", "p-eve",    "Eve",    "I will die on this hill", "2026-09-03T11:28:00Z"),

  msg("l016", "p-ravi",   "Ravi",   "is the dry cleaner on 3rd still closed? I've been waiting to pick up my coat for two weeks", "2026-09-04T09:00:00Z"),
  msg("l017", "p-claire", "Claire", "I walked past yesterday, looks open", "2026-09-04T09:05:00Z"),
  msg("l018", "p-ravi",   "Ravi",   "finally. thank you", "2026-09-04T09:07:00Z"),

  msg("l019", "p-sofia",  "Sofia",  "The Bear S3 is genuinely the most stressful beautiful thing I've watched in years", "2026-09-05T20:00:00Z"),
  msg("l020", "p-ravi",   "Ravi",   "the way it captures kitchen culture is just... accurate in a way that hurts", "2026-09-05T20:05:00Z"),
  msg("l021", "p-claire", "Claire", "Carmy's obsession with perfection. I understand it completely and it terrifies me", "2026-09-05T20:10:00Z"),
  msg("l022", "p-james",  "James",  "that episode set in Copenhagen is the one. pure television", "2026-09-05T20:15:00Z"),
  msg("l023", "p-eve",    "Eve",    "Copenhagen keeps showing up in my life as a sign. maybe I need to go", "2026-09-05T20:20:00Z"),
  msg("l024", "p-sofia",  "Sofia",  "same, it looks so liveable. which is a word I now use apparently", "2026-09-05T20:23:00Z"),
  msg("l025", "p-ravi",   "Ravi",   "it's a word. very Scandinavian concept", "2026-09-05T20:25:00Z"),

  msg("l026", "p-eve",    "Eve",    "heads up the Farmers Market on 3rd is doing a special Saturday thing this week if anyone's interested", "2026-09-06T10:00:00Z"),
  msg("l027", "p-james",  "James",  "what kind of thing?", "2026-09-06T10:05:00Z"),
  msg("l028", "p-eve",    "Eve",    "Japanese ceramics vendor apparently, I'm going at 10", "2026-09-06T10:07:00Z"),
  msg("l029", "p-claire", "Claire", "very much my thing. joining you", "2026-09-06T10:10:00Z"),

  msg("l030", "p-ravi",   "Ravi",   "went to the Gagosian opening last night. Kara Walker new work. completely stopped me in my tracks", "2026-09-07T10:00:00Z"),
  msg("l031", "p-claire", "Claire", "she is operating on a completely different plane. how was the crowd?", "2026-09-07T10:05:00Z"),
  msg("l032", "p-ravi",   "Ravi",   "curated. which is the right word for Gagosian", "2026-09-07T10:10:00Z"),
  msg("l033", "p-sofia",  "Sofia",  "I prefer the smaller galleries honestly. less performance", "2026-09-07T10:15:00Z"),
  msg("l034", "p-james",  "James",  "there's a small design gallery in Silver Lake worth checking. very Muji meets Dieter Rams", "2026-09-07T10:20:00Z"),
  msg("l035", "p-eve",    "Eve",    "adding to the list. Ravi you should come", "2026-09-07T10:22:00Z"),
  msg("l036", "p-ravi",   "Ravi",   "yes, when?", "2026-09-07T10:23:00Z"),
  msg("l037", "p-james",  "James",  "I'll check their hours and send in the group", "2026-09-07T10:25:00Z"),

  // Week 2
  msg("l038", "p-claire", "Claire", "Monday morning ambush: who left dishes in the sink again", "2026-09-09T08:30:00Z"),
  msg("l039", "p-sofia",  "Sofia",  "not me this time!! I can prove it", "2026-09-09T08:35:00Z"),
  msg("l040", "p-ravi",   "Ravi",   "I plead the fifth", "2026-09-09T08:37:00Z"),
  msg("l041", "p-eve",    "Eve",    "ravi", "2026-09-09T08:38:00Z"),
  msg("l042", "p-ravi",   "Ravi",   "they're soaking 🙃", "2026-09-09T08:39:00Z"),

  msg("l043", "p-eve",    "Eve",    "spent the weekend at Ace Hotel, just needed a reset honestly. that lobby never disappoints", "2026-09-10T09:30:00Z"),
  msg("l044", "p-claire", "Claire", "the Ace lobby is a masterclass in designed casualness. looks effortless, definitely isn't", "2026-09-10T09:35:00Z"),
  msg("l045", "p-james",  "James",  "Six Senses is my equivalent. that kind of quiet luxury is underrated", "2026-09-10T09:40:00Z"),
  msg("l046", "p-ravi",   "Ravi",   "yes. hotels where the design is invisible but you feel it constantly", "2026-09-10T09:45:00Z"),
  msg("l047", "p-sofia",  "Sofia",  "that's the dream. everything intentional, nothing announced", "2026-09-10T09:50:00Z"),
  msg("l048", "p-eve",    "Eve",    "I could write an essay on hotel lobbies and the fact that nobody asked me to is a shame", "2026-09-10T09:55:00Z"),

  msg("l049", "p-james",  "James",  "does anyone know a good tailor nearby? I have two jackets that need taking in", "2026-09-11T11:00:00Z"),
  msg("l050", "p-claire", "Claire", "yes, I'll send you the contact. she's on Beverly and does beautiful work", "2026-09-11T11:05:00Z"),
  msg("l051", "p-sofia",  "Sofia",  "bookmarking that for myself too", "2026-09-11T11:07:00Z"),

  msg("l052", "p-claire", "Claire", "new Bon Iver album. I'll say nothing more, just listen", "2026-09-12T15:00:00Z"),
  msg("l053", "p-eve",    "Eve",    "already on my third listen. the production on track 4 specifically", "2026-09-12T15:05:00Z"),
  msg("l054", "p-james",  "James",  "Bon Iver live at a good venue is one of my favourite experiences. that kind of quiet intensity", "2026-09-12T15:10:00Z"),
  msg("l055", "p-ravi",   "Ravi",   "Brian Eno has the same quality. music as atmosphere", "2026-09-12T15:15:00Z"),
  msg("l056", "p-sofia",  "Sofia",  "exactly. I had a Brian Eno ambient playlist on the whole time I was reading Knausgård last month", "2026-09-12T15:20:00Z"),
  msg("l057", "p-claire", "Claire", "this is the most us conversation we've ever had", "2026-09-12T15:22:00Z"),
  msg("l058", "p-eve",    "Eve",    "I'll take that", "2026-09-12T15:23:00Z"),

  msg("l059", "p-ravi",   "Ravi",   "has anyone tried to get a reservation at Osteria Mozza recently? asking for a date", "2026-09-13T12:00:00Z"),
  msg("l060", "p-james",  "James",  "it's brutal right now. try Tock, they release cancellations", "2026-09-13T12:05:00Z"),
  msg("l061", "p-sofia",  "Sofia",  "ooh a date! who is it", "2026-09-13T12:07:00Z"),
  msg("l062", "p-ravi",   "Ravi",   "someone from the ceramics thing on Saturday actually", "2026-09-13T12:10:00Z"),
  msg("l063", "p-eve",    "Eve",    "the ceramics thing that Claire and I were at?? and you didn't come??", "2026-09-13T12:12:00Z"),
  msg("l064", "p-ravi",   "Ravi",   "I went separately later ok", "2026-09-13T12:13:00Z"),

  msg("l065", "p-james",  "James",  "tried the new tasting menu at n/naka last night. 13 courses. each one better than the last", "2026-09-14T12:00:00Z"),
  msg("l066", "p-claire", "Claire", "n/naka is the best meal in LA, full stop. impossible to argue", "2026-09-14T12:05:00Z"),
  msg("l067", "p-eve",    "Eve",    "I haven't been. I feel personally attacked by this information", "2026-09-14T12:10:00Z"),
  msg("l068", "p-ravi",   "Ravi",   "the kaiseki format is so good. restraint as a philosophy applied to food", "2026-09-14T12:15:00Z"),
  msg("l069", "p-sofia",  "Sofia",  "adding this to the group trip list if we ever do one", "2026-09-14T12:20:00Z"),
  msg("l070", "p-james",  "James",  "the group trip needs to happen. I've been saying this for a year", "2026-09-14T12:22:00Z"),

  msg("l071", "p-claire", "Claire", "my Spotify is recommending me the most unhinged things right now. the algorithm has given up", "2026-09-15T17:00:00Z"),
  msg("l072", "p-eve",    "Eve",    "same, mine thinks I'm going through something", "2026-09-15T17:05:00Z"),
  msg("l073", "p-sofia",  "Sofia",  "it's the autumn energy. we all get weird in September", "2026-09-15T17:07:00Z"),

  // Week 3
  msg("l074", "p-eve",    "Eve",    "ok let's actually talk about doing a trip. all five of us. this year", "2026-09-20T10:00:00Z"),
  msg("l075", "p-james",  "James",  "finally. I've been waiting for someone to say it", "2026-09-20T10:05:00Z"),
  msg("l076", "p-claire", "Claire", "parameters: great design, serious food, some art. not a beach holiday", "2026-09-20T10:10:00Z"),
  msg("l077", "p-ravi",   "Ravi",   "agreed. I want to feel like I'm in a beautifully designed city that takes culture seriously", "2026-09-20T10:15:00Z"),
  msg("l078", "p-sofia",  "Sofia",  "Copenhagen keeps coming up. James already mentioned it. Eve you mentioned it", "2026-09-20T10:20:00Z"),
  msg("l079", "p-eve",    "Eve",    "it genuinely might be the answer. or Milan. or Tokyo", "2026-09-20T10:25:00Z"),
  msg("l080", "p-james",  "James",  "let Palatable decide. it's been listening, it knows us", "2026-09-20T10:28:00Z"),
  msg("l081", "p-claire", "Claire", "Palatable — where should the five of us go? 🎯", "2026-09-20T10:29:00Z"),
];

export const LUXURY_PRE_TRIGGER = LUXURY_MESSAGES.slice(0, 80);
export const LUXURY_TRIGGER = LUXURY_MESSAGES[80];

export const LUXURY_MESSAGES_FOR_EXTRACTION: RawMessage[] = LUXURY_MESSAGES.map((m) => ({
  participantId: m.participantId,
  participantName: m.participantName,
  text: m.text,
  timestamp: m.timestamp,
}));
