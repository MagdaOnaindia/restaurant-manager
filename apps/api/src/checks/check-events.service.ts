import { Injectable } from "@nestjs/common";
import { Subject, filter, map, merge, interval, type Observable } from "rxjs";

interface CheckEvent {
  checkId: string;
}

/**
 * In-memory bus of per-bill changes. Diners and the waiter view subscribe
 * over SSE to see payments in real time.
 * (Across multiple API replicas this would move to Redis pub/sub.)
 */
@Injectable()
export class CheckEventsService {
  private readonly subject = new Subject<CheckEvent>();

  emit(checkId: string) {
    this.subject.next({ checkId });
  }

  /** SSE stream: bill "update" events + a 25s heartbeat to keep the connection alive. */
  streamFor(checkId: string): Observable<{ data: string; type: string }> {
    const updates = this.subject.pipe(
      filter((e) => e.checkId === checkId),
      map(() => ({ type: "update", data: JSON.stringify({ at: Date.now() }) })),
    );
    const heartbeat = interval(25_000).pipe(
      map(() => ({ type: "ping", data: "keepalive" })),
    );
    return merge(updates, heartbeat);
  }
}
