# Silence is claimed only after coming back has been tried and failed

A live connection drops constantly. A phone changes network, a laptop sleeps for a second, a proxy times an idle socket out — and the browser reconnects on its own, every Room resumes from its own sequence number, and what was missed arrives. None of that is worth a word to the User, and an interface that announced each one would be teaching its readers to ignore the announcement that matters.

**So a connection being down is not what is reported.** What is reported is a connection that has tried to come back and could not: the first reconnect attempt is a second after the drop and succeeds for every ordinary blip, so a *second* attempt being scheduled is the transport saying the first was refused. That is the point at which a screen has genuinely stopped being kept current, and the point at which the User is told.

The threshold is one failed attempt rather than a stopwatch. A timer would be measuring the wrong thing — a slow reconnect that works is fine, and a refused reconnect is not made better by being recent — and it would have to be tuned against reconnection backoff that the transport owns.

**Being told is a state the screen leaves as well as one it enters.** The browser goes on retrying indefinitely, so the message says what is true and asks for nothing: no reload, no button. When the connection comes back the message goes, the Rooms resume, and the reader is looking at a current screen again. Telling somebody to reload would be worse advice than waiting, and a banner that stayed up after recovery would be the same lie in the other direction.

The alternative to all of this is the failure that matters: a screen that has silently stopped updating looks exactly like a working one, and a User answering a customer from an hours-old queue has been actively misled by this application rather than merely underserved by it.
