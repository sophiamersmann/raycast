import {
  Action,
  ActionPanel,
  Clipboard,
  List,
  Toast,
  Icon,
  showToast,
  open,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { makeGrapherURL, usePullRequests, linkIcon } from "./utils";

const GITHUB_REPO = "owid/owid-grapher";
const GITHUB_USER_NAME = "sophiamersmann";

const BROWSER_PATH = "/Applications/Google Chrome.app";
const BROWSER_NAME = "Google Chrome";

const ARC_PATH = "/Applications/Arc.app";

const LIVE_URL = "https://ourworldindata.org";
const LOCAL_URL = "http://localhost:3030";

const DEFAULT_SLUG = "life-expectancy";

const SLUG_REGEX = /^[a-zA-Z-]+$/m;
const GRAPHER_URL_REGEX = /^https?:\/\/.+\/grapher\/(?<slug>.+)$/m;

export default function Command() {
  const { data: clipboardText = "", isLoading: isLoadingClipboard } =
    usePromise(Clipboard.readText, [], {
      onError: async () => {
        showToast(Toast.Style.Failure, "Failed to read clipboard content");
      },
    });
  const { pullRequests, isLoading: isLoadingPullRequests } = usePullRequests(
    GITHUB_REPO,
    GITHUB_USER_NAME,
  );

  const cleanText = clipboardText.trim();
  const isSlug = cleanText.match(SLUG_REGEX) !== null;
  const grapherUrlMatch = cleanText.match(GRAPHER_URL_REGEX);
  const grapherUrlSlug = grapherUrlMatch?.groups?.slug;
  const slug = grapherUrlSlug ?? (isSlug ? cleanText : DEFAULT_SLUG);

  const liveUrl = makeGrapherURL(LIVE_URL, slug);
  const localUrl = makeGrapherURL(LOCAL_URL, slug);

  return (
    <List isLoading={isLoadingClipboard || isLoadingPullRequests}>
      <List.Item
        key="prod"
        title={liveUrl}
        accessories={[{ text: "Live" }]}
        icon={linkIcon}
        actions={<LinkActionPanel url={liveUrl} />}
      />
      <List.Item
        key="local"
        title={localUrl}
        accessories={[{ text: "Local" }]}
        icon={linkIcon}
        actions={<LinkActionPanel url={localUrl} />}
      />
      <List.Section title="Staging">
        {pullRequests.map((pr) => (
          <List.Item
            key={pr.staging}
            title={makeGrapherURL(pr.staging, slug)}
            accessories={[{ text: "Staging" }]}
            icon={linkIcon}
            actions={<LinkActionPanel url={makeGrapherURL(pr.staging, slug)} />}
          />
        ))}
      </List.Section>
    </List>
  );
}

function LinkActionPanel({ url }: { url: string }) {
  return (
    <ActionPanel>
      <Action
        title={`Open in ${BROWSER_NAME}`}
        icon={Icon.Globe}
        onAction={() => open(url, BROWSER_PATH)}
      />
      <Action
        title="Open in Little Arc"
        icon={Icon.Globe}
        onAction={() => open(url, ARC_PATH)}
      />
      <Action.CopyToClipboard title="Copy Link" content={url} />
    </ActionPanel>
  );
}
