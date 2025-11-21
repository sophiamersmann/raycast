import { Action, Icon, open } from "@raycast/api";
import { ARC_PATH, GOOGLE_CHROME_PATH, FIREFOX_PATH } from "./constants";

export function OpenInChromeAction({ url }: { url: string }) {
  return (
    <Action
      title={`Open in Google Chrome`}
      icon={Icon.Globe}
      onAction={() => {
        open(url, GOOGLE_CHROME_PATH);
      }}
    />
  );
}

export function OpenInArcAction({ url }: { url: string }) {
  return (
    <Action
      title="Open in Little Arc"
      icon={Icon.Globe}
      onAction={() => {
        open(url, ARC_PATH);
      }}
    />
  );
}

export function OpenInFirefoxAction({ url }: { url: string }) {
  return (
    <Action
      title={`Open in Firefox`}
      icon={Icon.Globe}
      onAction={() => {
        open(url, FIREFOX_PATH);
      }}
    />
  );
}
