import type { MessageRecord, GroupRecord } from "@/lib/db/schema";
import type { RawMessage } from "@/lib/extract/anchors";

export const ADVENTURE_GROUP: GroupRecord = {
  groupId: "group-demo-002",
  name: "The Adventure Crew",
  participants: ["p-sam", "p-leo", "p-priya"],
  createdAt: "2026-09-01T10:00:00Z",
};

export const ADVENTURE_PARTICIPANTS = [
  { id: "p-sam",   name: "Sam",   avatar: "S", color: "#10b981" },
  { id: "p-leo",   name: "Leo",   avatar: "L", color: "#f59e0b" },
  { id: "p-priya", name: "Priya", avatar: "P", color: "#6366f1" },
];

function msg(
  id: string,
  participantId: string,
  participantName: string,
  text: string,
  timestamp: string,
): MessageRecord {
  return {
    groupId: "group-demo-002",
    sortKey: `${timestamp}#${id}`,
    participantId,
    participantName,
    text,
    timestamp,
    processed: false,
  };
}

export const ADVENTURE_MESSAGES: MessageRecord[] = [
  // Week 1
  msg("a001", "p-sam",   "Sam",   "just got back from the REI sale, fully geared up for whatever we plan next", "2026-09-02T08:30:00Z"),
  msg("a002", "p-leo",   "Leo",   "what did you get?? I've been eyeing the Patagonia rain jacket forever", "2026-09-02T08:35:00Z"),
  msg("a003", "p-sam",   "Sam",   "Patagonia jacket + new trail runners. the salesperson judged me a little I think", "2026-09-02T08:40:00Z"),
  msg("a004", "p-priya", "Priya", "no judgment, that jacket is worth every penny", "2026-09-02T08:45:00Z"),
  msg("a005", "p-leo",   "Leo",   "ok what time is everyone getting to the gym tonight", "2026-09-02T09:00:00Z"),
  msg("a006", "p-sam",   "Sam",   "6:30 works for me", "2026-09-02T09:05:00Z"),
  msg("a007", "p-priya", "Priya", "make it 7, I have a call that runs late", "2026-09-02T09:06:00Z"),

  msg("a008", "p-leo",   "Leo",   "finished Bad Bunny's new album on my run this morning. genuinely incredible start to finish", "2026-09-03T07:15:00Z"),
  msg("a009", "p-sam",   "Sam",   "been on a Kendrick Lamar loop myself. the To Pimp a Butterfly run never gets old", "2026-09-03T07:20:00Z"),
  msg("a010", "p-priya", "Priya", "different energy but I've been running to Khruangbin, somehow works perfectly", "2026-09-03T07:25:00Z"),
  msg("a011", "p-leo",   "Leo",   "Khruangbin for running is elite actually", "2026-09-03T07:28:00Z"),
  msg("a012", "p-sam",   "Sam",   "update: I forgot my headphones today so just vibed with traffic sounds", "2026-09-03T07:45:00Z"),
  msg("a013", "p-priya", "Priya", "that's called mindfulness Sam", "2026-09-03T07:46:00Z"),

  msg("a014", "p-priya", "Priya", "anyone know a good mechanic around here? my check engine light came on", "2026-09-04T10:00:00Z"),
  msg("a015", "p-leo",   "Leo",   "AutoZone will read the code for free at least, find out what it is first", "2026-09-04T10:05:00Z"),
  msg("a016", "p-sam",   "Sam",   "I use a guy on Fletcher, I'll DM you the number", "2026-09-04T10:08:00Z"),

  msg("a017", "p-sam",   "Sam",   "tried that new taco spot on Sunset, best al pastor I've had since Mexico City", "2026-09-05T13:00:00Z"),
  msg("a018", "p-leo",   "Leo",   "nothing beats eating tacos from a street cart at 1am honestly", "2026-09-05T13:05:00Z"),
  msg("a019", "p-priya", "Priya", "the more chaotic the setup the better the food, universal law", "2026-09-05T13:10:00Z"),
  msg("a020", "p-sam",   "Sam",   "hard agree. hole in the wall > michelin star every time", "2026-09-05T13:15:00Z"),
  msg("a021", "p-leo",   "Leo",   "the taco place or the mechanic, which is more urgent priya", "2026-09-05T13:16:00Z"),
  msg("a022", "p-priya", "Priya", "both are emergencies", "2026-09-05T13:17:00Z"),

  msg("a023", "p-priya", "Priya", "watched Into the Wild again last night. still hits different every time", "2026-09-07T21:00:00Z"),
  msg("a024", "p-leo",   "Leo",   "that movie broke something in me when I was 19 and it never healed", "2026-09-07T21:05:00Z"),
  msg("a025", "p-sam",   "Sam",   "same. also watched Free Solo last week for the 4th time", "2026-09-07T21:10:00Z"),
  msg("a026", "p-priya", "Priya", "Free Solo is the most stressful viewing experience of my life and I love it", "2026-09-07T21:15:00Z"),
  msg("a027", "p-leo",   "Leo",   "Alex Honnold is built different. genuinely a different species", "2026-09-07T21:20:00Z"),
  msg("a028", "p-sam",   "Sam",   "I need to sleep but I'm watching it again aren't I", "2026-09-07T21:22:00Z"),
  msg("a029", "p-priya", "Priya", "that's just who you are now", "2026-09-07T21:23:00Z"),

  // Week 2
  msg("a030", "p-sam",   "Sam",   "heads up the trail is closed this weekend for maintenance apparently", "2026-09-08T08:00:00Z"),
  msg("a031", "p-leo",   "Leo",   "which one?", "2026-09-08T08:05:00Z"),
  msg("a032", "p-sam",   "Sam",   "Runyon. going to try the Griffith trails instead", "2026-09-08T08:07:00Z"),
  msg("a033", "p-priya", "Priya", "good call, better views anyway", "2026-09-08T08:10:00Z"),

  msg("a034", "p-leo",   "Leo",   "went hiking in Griffith Park at 6am, caught the sunrise, absolutely worth it", "2026-09-10T09:00:00Z"),
  msg("a035", "p-sam",   "Sam",   "I keep saying I'll do that and never do. what trail?", "2026-09-10T09:05:00Z"),
  msg("a036", "p-leo",   "Leo",   "the one up to the observatory. easy enough that you're not dying but views are insane", "2026-09-10T09:10:00Z"),
  msg("a037", "p-priya", "Priya", "I did that trail before a festival once, best decision I've ever made energy-wise", "2026-09-10T09:15:00Z"),
  msg("a038", "p-sam",   "Sam",   "what festival?", "2026-09-10T09:16:00Z"),
  msg("a039", "p-priya", "Priya", "FYF, back when it existed. miss that thing", "2026-09-10T09:18:00Z"),

  msg("a040", "p-leo",   "Leo",   "anyone else getting spam calls all week or just me", "2026-09-11T12:00:00Z"),
  msg("a041", "p-sam",   "Sam",   "constantly. I've stopped answering unknown numbers entirely", "2026-09-11T12:05:00Z"),
  msg("a042", "p-priya", "Priya", "same, my voicemail is full of insurance scams", "2026-09-11T12:07:00Z"),

  msg("a043", "p-sam",   "Sam",   "Coachella lineup dropped. thoughts?", "2026-09-12T11:00:00Z"),
  msg("a044", "p-leo",   "Leo",   "strong headliners. Bad Bunny headlining makes complete sense right now", "2026-09-12T11:05:00Z"),
  msg("a045", "p-priya", "Priya", "I'd go for the smaller stages honestly. that's where the real discoveries happen", "2026-09-12T11:10:00Z"),
  msg("a046", "p-sam",   "Sam",   "100%. saw Khruangbin on a tiny stage before they blew up, unforgettable", "2026-09-12T11:15:00Z"),
  msg("a047", "p-leo",   "Leo",   "are we actually going this year or are we doing the thing where we say we'll go and don't", "2026-09-12T11:18:00Z"),
  msg("a048", "p-priya", "Priya", "historically: the second thing", "2026-09-12T11:20:00Z"),

  msg("a049", "p-priya", "Priya", "went to the Grand Central Market, that place never disappoints", "2026-09-14T14:00:00Z"),
  msg("a050", "p-leo",   "Leo",   "the egg slut line is always too long but also always worth it", "2026-09-14T14:05:00Z"),
  msg("a051", "p-sam",   "Sam",   "markets like that are my favourite thing about any city honestly", "2026-09-14T14:10:00Z"),
  msg("a052", "p-priya", "Priya", "yes! a good food market tells you everything about a place's culture", "2026-09-14T14:15:00Z"),
  msg("a053", "p-leo",   "Leo",   "I ate three things and immediately needed a nap", "2026-09-14T14:17:00Z"),
  msg("a054", "p-sam",   "Sam",   "that's the correct experience", "2026-09-14T14:18:00Z"),

  msg("a055", "p-sam",   "Sam",   "my landlord is being impossible about the AC unit again", "2026-09-15T16:00:00Z"),
  msg("a056", "p-leo",   "Leo",   "document everything in writing, always", "2026-09-15T16:05:00Z"),
  msg("a057", "p-priya", "Priya", "this is why I want to move honestly", "2026-09-15T16:08:00Z"),

  msg("a058", "p-leo",   "Leo",   "anyone else been watching Meru? the climbing documentary. genuinely unhinged in the best way", "2026-09-16T20:00:00Z"),
  msg("a059", "p-sam",   "Sam",   "watched it with my flatmate last month, we were both sweating", "2026-09-16T20:05:00Z"),
  msg("a060", "p-priya", "Priya", "adding it. also Patagonia just dropped a new sustainability doc, worth watching", "2026-09-16T20:10:00Z"),
  msg("a061", "p-leo",   "Leo",   "Patagonia's whole brand ethos is so consistent, rare thing these days", "2026-09-16T20:15:00Z"),

  msg("a062", "p-priya", "Priya", "ok does anyone actually use their gym locker or are we all just winging it", "2026-09-17T08:00:00Z"),
  msg("a063", "p-sam",   "Sam",   "winging it every single time", "2026-09-17T08:02:00Z"),
  msg("a064", "p-leo",   "Leo",   "I've lost two locks this year", "2026-09-17T08:03:00Z"),

  // Week 3
  msg("a065", "p-sam",   "Sam",   "ok I need a trip. like genuinely need one. when are we doing something", "2026-09-20T10:00:00Z"),
  msg("a066", "p-leo",   "Leo",   "same energy. I have some time in October", "2026-09-20T10:05:00Z"),
  msg("a067", "p-priya", "Priya", "me too. what are we thinking — adventure-y but also good food scene?", "2026-09-20T10:10:00Z"),
  msg("a068", "p-sam",   "Sam",   "yes exactly. not a beach resort. somewhere with actual stuff to do and explore", "2026-09-20T10:15:00Z"),
  msg("a069", "p-leo",   "Leo",   "somewhere with a music scene too if possible. live music is non-negotiable for me", "2026-09-20T10:20:00Z"),
  msg("a070", "p-priya", "Priya", "and street food. I need to eat well or I'm insufferable", "2026-09-20T10:22:00Z"),
  msg("a071", "p-sam",   "Sam",   "let's just ask Palatable, it'll know us better than we know ourselves at this point", "2026-09-20T10:25:00Z"),
  msg("a072", "p-leo",   "Leo",   "yes! palatable where should the three of us go? 👀", "2026-09-20T10:26:00Z"),
];

export const ADVENTURE_PRE_TRIGGER = ADVENTURE_MESSAGES.slice(0, 71);
export const ADVENTURE_TRIGGER = ADVENTURE_MESSAGES[71];

export const ADVENTURE_MESSAGES_FOR_EXTRACTION: RawMessage[] = ADVENTURE_MESSAGES.map((m) => ({
  participantId: m.participantId,
  participantName: m.participantName,
  text: m.text,
  timestamp: m.timestamp,
}));
