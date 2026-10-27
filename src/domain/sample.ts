import { addDays, todayISO } from './dates';
import { uid } from './format';
import type { Goal, ISODate, Resource, Section } from './types';

/** The demo goal shown on first run, with a few items already done relative to today. */
export function sampleGoal(today: ISODate = todayISO()): Goal {
  const d = (n: number) => addDays(today, n);
  const R = (o: Partial<Resource> & Pick<Resource, 'title' | 'type'>): Resource => ({
    id: uid(),
    url: '',
    notes: '',
    minutes: 15,
    done: false,
    doneAt: null,
    rating: null,
    sections: [],
    ...o,
  });
  const S = (title: string, minutes: number, doneAt?: ISODate): Section => ({
    id: uid(),
    title,
    minutes,
    done: !!doneAt,
    doneAt: doneAt ?? null,
  });

  return {
    id: uid(),
    name: 'Senior iOS interview prep',
    targetDate: d(35),
    hoursPerDay: 1.5,
    sample: true,
    createdAt: d(-4),
    resources: [
      R({
        title: 'The Swift Programming Language: Concurrency',
        url: 'https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/',
        type: 'article',
        minutes: 45,
        done: true,
        doneAt: d(-3),
        rating: 4,
      }),
      R({
        title: 'WWDC21: Meet async/await in Swift',
        url: 'https://developer.apple.com/videos/play/wwdc2021/10132/',
        type: 'video',
        minutes: 35,
        done: true,
        doneAt: d(-2),
        rating: 3,
      }),
      R({
        title: 'iOS system design interview prep',
        url: 'https://www.udemy.com/courses/search/?q=ios%20system%20design',
        type: 'course',
        notes: 'Focus on caching and offline sync. Most loops ask about it.',
        sections: [
          S('Requirements and API design', 90, d(-1)),
          S('Caching and offline support', 120),
          S('Networking layer', 120),
          S('Image loading pipeline', 90),
          S('Mock interviews', 120),
        ],
      }),
      R({
        title: 'SE-0306: Actors',
        url: 'https://github.com/apple/swift-evolution/blob/main/proposals/0306-actors.md',
        type: 'article',
        minutes: 40,
      }),
      R({
        title: 'WWDC23: Discover Observation in SwiftUI',
        url: 'https://developer.apple.com/videos/play/wwdc2023/10149/',
        type: 'video',
        minutes: 20,
      }),
      R({
        title: 'ARC and retain cycles deep dive',
        url: 'https://www.youtube.com/results?search_query=swift+arc+retain+cycles',
        type: 'video',
        minutes: 30,
      }),
      R({
        title: 'LeetCode Top Interview 150',
        url: 'https://leetcode.com/studyplan/top-interview-150/',
        type: 'course',
        sections: [
          S('Arrays and strings', 240),
          S('Two pointers and sliding window', 180),
          S('Trees and graphs', 300),
          S('Dynamic programming', 240),
        ],
      }),
    ],
  };
}
