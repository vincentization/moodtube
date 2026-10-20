import type { Metadata } from "next";
import { Strip, Wordmark } from "@/components/Header";

export const metadata: Metadata = { title: "Privacy · Moodtube" };

// Public (outside the password wall), so Google's OAuth consent screen can link to it.
export default function PrivacyPage() {
  return (
    <main className="login-page">
      <div className="console login-console privacy-console">
        <div className="hdr">
          <Wordmark />
          <Strip />
        </div>
        <article className="privacy tray">
          <h1 className="tray-label">PRIVACY POLICY</h1>
          <p>
            Moodtube is a personal, password-protected YouTube subscription feed. Each deployment is run by one person for
            their own use.
          </p>
          <h2 className="tray-label">WHAT IT READS FROM GOOGLE</h2>
          <p>
            When you connect YouTube, Moodtube asks for read-only access to your YouTube account. It uses that access only
            to read the list of channels you subscribe to and your own channel name, so the feed can follow your
            subscriptions. It can&apos;t post, comment, subscribe, unsubscribe or change anything on your account.
          </p>
          <h2 className="tray-label">WHAT IT STORES</h2>
          <p>
            The subscribed channels&apos; IDs and titles, your channel name, and the access token Google issues, kept in
            this deployment&apos;s own database. It also stores what you do in the app: groups, watched and watch-later
            videos. Nothing is sold, shared with anyone else or used for advertising. There are no analytics or tracking.
          </p>
          <h2 className="tray-label">REMOVING ACCESS</h2>
          <p>
            Press Disconnect on the Channels page to revoke Moodtube&apos;s access and delete the token, or remove it at{" "}
            <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
          </p>
          <p>
            Moodtube&apos;s use of information received from Google APIs adheres to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
            including the Limited Use requirements. It uses YouTube API Services; see the{" "}
            <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a> and the{" "}
            <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
          </p>
        </article>
      </div>
    </main>
  );
}
