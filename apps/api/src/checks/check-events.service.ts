import { Injectable } from "@nestjs/common";
import { Subject, filter, map, merge, interval, type Observable } from "rxjs";

interface CheckEvent {
  checkId: string;
}

/**
 * Bus en memoria de cambios por cuenta. Los comensales y el comandero se
 * suscriben por SSE para ver los pagos en tiempo real.
 * (Con varias réplicas de la API esto pasaría a Redis pub/sub.)
 */
@Injectable()
export class CheckEventsService {
  private readonly subject = new Subject<CheckEvent>();

  emit(checkId: string) {
    this.subject.next({ checkId });
  }

  /** Stream SSE: eventos "update" de la cuenta + latido cada 25s para mantener viva la conexión. */
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
