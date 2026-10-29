# Writing a Prepline plan file

These are instructions for an AI agent. Give them to the agent along with a request
such as "Make me an iOS developer interview preparation plan, target date
2026-12-31, 2 hours a day." The agent researches real study resources and returns
one JSON file. Prepline imports it with **Backup and restore → Choose File → Add to
My Plans**, which keeps the user's existing plans.

## 1. Your task

1. Find out the topic, the **target date** and the **hours per day** the user can study.
   If the date or hours are missing, ask for them. If you can't ask, use a date
   8 weeks from today and 2 hours a day, and say so in the plan's `description`.
2. Research resources. Open every URL you include and check that it loads and is
   what you describe. **Never invent or guess a URL.**
3. Group the resources into phases, put them in study order, and estimate each one's
   study time.
4. Return **only the JSON**, as a file named `prepline-plan-<topic>.json`, for
   example `prepline-plan-ios-interview.json`. Put any comments outside the file.

## 2. File shape

```json
{
  "version": 1,
  "goals": [
    {
      "id": "…",
      "name": "…",
      "description": "…",
      "targetDate": "YYYY-MM-DD",
      "hoursPerDay": 2,
      "phases": [{ "id": "…", "name": "…", "description": "…", "color": "blue" }],
      "resources": [
        {
          "id": "…",
          "title": "…",
          "url": "https://…",
          "type": "article",
          "minutes": 45,
          "notes": "…",
          "phaseId": "…"
        }
      ]
    }
  ]
}
```

- `version` must be `1`. Any other value is rejected.
- `goals` is the list of **plans** (the code calls a plan a "goal"). It is required.
  Usually it holds one plan.
- Use plain JSON: no comments and no trailing commas.

## 3. Field reference

### Plan (`goals[]`)

| Field         | Required | Type             | Meaning and limits                                                                                                                      |
| ------------- | -------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | yes      | string           | Plan title shown everywhere. Max 120 characters.                                                                                        |
| `description` | no       | string           | One to three sentences on the aim and level. Max 1000 characters.                                                                       |
| `targetDate`  | no       | `"YYYY-MM-DD"`   | The date the user wants to be ready. Must be a real calendar date. Defaults to 30 days from import.                                     |
| `hoursPerDay` | no       | number or `null` | Daily study capacity, 0.25 to 16. Prepline uses it to say whether the plan is on track. With `null` it shows only the pace needed.      |
| `id`          | no       | string           | Any unique string. Prepline gives every plan, phase and resource new ids on import. You only need ids so resources can point at phases. |
| `phases`      | no       | array            | Optional groups, shown as milestones. See below.                                                                                        |
| `resources`   | no       | array            | The study items, **in the order the user should do them**.                                                                              |

### Phase (`phases[]`)

| Field         | Required | Type   | Meaning and limits                                                                 |
| ------------- | -------- | ------ | ---------------------------------------------------------------------------------- |
| `id`          | yes\*    | string | Unique within the plan, for example `"swift"`. \*Required if any resource uses it. |
| `name`        | yes      | string | Short milestone name. Max 80 characters.                                           |
| `description` | no       | string | What this phase covers and why. Max 500 characters.                                |
| `color`       | no       | string | One of `blue`, `purple`, `green`, `orange`, `red`, `pink`, `gray`. Default `blue`. |

### Resource (`resources[]`)

| Field     | Required | Type             | Meaning and limits                                                                                  |
| --------- | -------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `title`   | yes      | string           | The resource's real title, with the source in brackets if it helps, for example `"… (WWDC21)"`.     |
| `url`     | no       | string           | Full `https://` link that you have checked. Use `""` only for offline items such as a printed book. |
| `type`    | no       | string           | `article`, `video`, `course` or `practice`. See section 4. An unknown value becomes `article`.      |
| `minutes` | no       | whole number     | Estimated **study** time in minutes, 1 to 100000. See section 5. Defaults to 30.                    |
| `notes`   | no       | string           | One or two sentences: why it matters and what to focus on. Say if it is paid.                       |
| `phaseId` | no       | string or `null` | The `id` of a phase **in the same plan**, or `null` for no phase. An unknown id becomes `null`.     |
| `id`      | no       | string           | Any unique string.                                                                                  |

Leave these out of a new plan. They record the user's own progress:
`done`, `doneMinutes`, `doneAt`, `startedAt`, `createdAt`. Prepline ignores any other key.

## 4. Choosing `type`

Decide by **what the learner does** with the resource, not by the website it is on.

| Type       | Use it for                                                        | Examples                                                                                                                  |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `video`    | One recording to watch.                                           | A conference talk, a WWDC session, a single YouTube tutorial.                                                             |
| `article`  | One page or chapter to read.                                      | A blog post, an official documentation page, a guide, a cheat sheet, one book chapter.                                    |
| `course`   | A structured curriculum of several lessons with its own syllabus. | Udemy, Coursera or Kodeco courses, "100 Days of …", a whole book, a multi-part video series.                              |
| `practice` | Active work where the learner produces something.                 | Problem sets, a single coding problem, mock interviews, interview question drills, a build-this-app exercise, flashcards. |

Tie-breakers:

- A YouTube **playlist or series** you follow lesson by lesson → `course`. One video from it → `video`.
- A **list of problems** → `practice`. A **guided study plan** that teaches as it goes → `course`.
- A page of **interview questions** the user should answer aloud → `practice`. A page that explains the answers → `article`.
- When it is unclear → `article`.

## 5. Estimating `minutes`

Progress in Prepline is weighted by these estimates, not by the number of resources,
so make them realistic. Estimate **study time**: watching or reading plus taking
notes and trying things out.

| Type       | Rule of thumb                                                                                                     | Default if unknown |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ------------------ |
| `video`    | Runtime × 1.25 (pausing and notes).                                                                               | 60                 |
| `article`  | About 200 words a minute, plus 5 to 15 minutes if it has code to try.                                             | 30                 |
| `course`   | The stated length × 1.5 (exercises). If the user only needs part of it, estimate that part and say so in `notes`. | 600                |
| `practice` | The time to budget: about 30 to 45 minutes per coding problem, 60 to 90 minutes per mock interview.               | 120                |

Round to whole minutes.

## 6. Fitting the schedule

- **Capacity** = days from today to `targetDate` × `hoursPerDay` × 60 minutes.
- Keep the total of all `minutes` at or below **80% of capacity**, to leave room
  for review and missed days.
- If the material doesn't fit, keep the most important resources, scope big courses
  down (for example "sections 1 to 6", with fewer minutes), and mention what you
  left out in your reply, not in the file.

## 7. Order and phases

- **The order of `resources` is the study order.** Prepline's journey follows it
  from first to last and suggests the first unfinished item next. Put foundations
  before advanced topics and practice after the theory it uses. Keep each phase's
  resources together.
- The order of `phases` only sets the order they are listed in.
- Use **3 to 6 phases** for plans over about 20 hours, each with a different color.
  A small plan can skip phases: leave out `phases` and set no `phaseId`.

## 8. Choosing resources

- Prefer official documentation and well-known, maintained sources.
- Prefer free resources. Include paid ones only when they are clearly the best
  option, and write "Paid." in `notes`.
- Don't include two resources that teach the same thing.
- Mix types: reading and video for concepts, `practice` to prove them. Interview
  plans should end with practice and at least one mock interview.

## 9. Before you return the file

- [ ] It parses as JSON, with `"version": 1` and a `goals` array.
- [ ] Every plan has a `name`, every phase a `name`, every resource a `title`.
- [ ] Every `phaseId` matches a phase `id` in the same plan.
- [ ] `type` is one of `article`, `video`, `course`, `practice`.
- [ ] `minutes` are whole numbers, and their total fits 80% of capacity.
- [ ] `targetDate` is a real date written `YYYY-MM-DD`, and it is in the future.
- [ ] Every URL was opened and checked during this task.

## 10. Example

A complete file, also in [`examples/ios-interview-prep.json`](examples/ios-interview-prep.json).
The total is 4825 minutes (about 80 hours). At 2 hours a day, that fits within 80% of
capacity when there are at least 51 days to go.

```json
{
  "version": 1,
  "goals": [
    {
      "id": "ios-interview",
      "name": "iOS Developer Interview Preparation",
      "description": "Get ready for mid-level iOS interviews: Swift memory and concurrency, SwiftUI, coding problems, and a mock interview.",
      "targetDate": "2026-12-31",
      "hoursPerDay": 2,
      "phases": [
        {
          "id": "swift",
          "name": "Swift Fundamentals",
          "description": "Memory management and concurrency, the topics most iOS interviews probe first.",
          "color": "blue"
        },
        {
          "id": "swiftui",
          "name": "SwiftUI",
          "description": "How SwiftUI tracks identity and state, and enough hands-on building to talk about it with confidence.",
          "color": "purple"
        },
        {
          "id": "interview",
          "name": "Interview Practice",
          "description": "Coding problems, common iOS questions, and a timed mock interview.",
          "color": "green"
        }
      ],
      "resources": [
        {
          "id": "arc",
          "title": "Automatic Reference Counting (The Swift Programming Language)",
          "url": "https://docs.swift.org/swift-book/documentation/the-swift-programming-language/automaticreferencecounting/",
          "type": "article",
          "minutes": 45,
          "notes": "Know strong reference cycles and when to use weak versus unowned, including in closures.",
          "phaseId": "swift"
        },
        {
          "id": "concurrency",
          "title": "Concurrency (The Swift Programming Language)",
          "url": "https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/",
          "type": "article",
          "minutes": 60,
          "notes": "Focus on tasks, task groups, actors and Sendable. Be ready to explain data races.",
          "phaseId": "swift"
        },
        {
          "id": "async-await",
          "title": "Meet async/await in Swift (WWDC21)",
          "url": "https://developer.apple.com/videos/play/wwdc2021/10132/",
          "type": "video",
          "minutes": 50,
          "notes": "Watch how completion handlers become async functions. A common whiteboard question.",
          "phaseId": "swift"
        },
        {
          "id": "demystify-swiftui",
          "title": "Demystify SwiftUI (WWDC21)",
          "url": "https://developer.apple.com/videos/play/wwdc2021/10022/",
          "type": "video",
          "minutes": 50,
          "notes": "Identity, lifetime and dependencies: the basis for answering why a view redraws or loses state.",
          "phaseId": "swiftui"
        },
        {
          "id": "100-days",
          "title": "100 Days of SwiftUI (Hacking with Swift)",
          "url": "https://www.hackingwithswift.com/100/swiftui",
          "type": "course",
          "minutes": 2400,
          "notes": "Free. Budget for the projects and consolidation days you need, not all 100 days.",
          "phaseId": "swiftui"
        },
        {
          "id": "neetcode",
          "title": "NeetCode Practice",
          "url": "https://neetcode.io/practice",
          "type": "practice",
          "minutes": 1800,
          "notes": "Work through arrays, hashing, two pointers, trees and graphs. Solve in Swift, out loud.",
          "phaseId": "interview"
        },
        {
          "id": "hws-questions",
          "title": "iOS Interview Questions (Hacking with Swift)",
          "url": "https://www.hackingwithswift.com/interview-questions",
          "type": "practice",
          "minutes": 300,
          "notes": "Answer each question aloud before reading the hints, as you would in the interview.",
          "phaseId": "interview"
        },
        {
          "id": "mock",
          "title": "Mock interview on interviewing.io",
          "url": "https://interviewing.io/",
          "type": "practice",
          "minutes": 120,
          "notes": "Book one timed mock in the last two weeks. Some sessions are paid.",
          "phaseId": "interview"
        }
      ]
    }
  ]
}
```
