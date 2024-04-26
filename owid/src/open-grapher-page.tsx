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
import {
  makeGrapherURL,
  usePullRequests,
  linkIcon,
  isValidSlug,
} from "./utils";

const GITHUB_REPO = "owid/owid-grapher";
const GITHUB_USER_NAME = "sophiamersmann";

const BROWSER_PATH = "/Applications/Google Chrome.app";
const BROWSER_NAME = "Google Chrome";

const ARC_PATH = "/Applications/Arc.app";

const LIVE_URL = "https://ourworldindata.org";
const LOCAL_URL = "http://localhost:3030";

const DEFAULT_SLUG = "life-expectancy";

const GRAPHER_URL_REGEX = /^https?:\/\/.+\/grapher\/(?<slug>.+)$/gm;

export default function Command() {
  const { data: clipboardText = "", isLoading: isLoadingClipboardText } =
    usePromise(Clipboard.readText, [], {
      onError: async () => {
        showToast(Toast.Style.Failure, "Failed to read clipboard content");
      },
    });
  const { pullRequests, isLoading: isLoadingPullRequests } = usePullRequests(
    GITHUB_REPO,
    GITHUB_USER_NAME,
  );

  const maybeSlugOrUrl = clipboardText.trim();

  // check if the clipboard content is a grapher URL and if so grab its slug
  const grapherUrlSlug = maybeSlugOrUrl.match(GRAPHER_URL_REGEX)?.groups?.slug;

  // check if the clipboard content is a valid slug associated with a chart
  const { isValid, isLoading: isWaitingForSlugValidation } =
    isValidSlug(maybeSlugOrUrl);

  // use the default slug if no valid slug was found
  const slug = grapherUrlSlug ?? (isValid ? maybeSlugOrUrl : DEFAULT_SLUG);

  const isLoading =
    isLoadingClipboardText ||
    isLoadingPullRequests ||
    isWaitingForSlugValidation;

  if (!isLoading && slug === DEFAULT_SLUG && maybeSlugOrUrl !== DEFAULT_SLUG) {
    showToast(
      Toast.Style.Failure,
      `No valid slug detected. Using ${DEFAULT_SLUG}`,
    );
  }

  return (
    <List isLoading={isLoading}>
      <List.Item
        key="prod"
        title={makeGrapherURL(LIVE_URL, slug)}
        accessories={[{ text: "Live" }]}
        icon={linkIcon}
        actions={<LinkActionPanel baseUrl={LIVE_URL} slug={slug} />}
      />
      <List.Item
        key="local"
        title={makeGrapherURL(LOCAL_URL, slug)}
        accessories={[{ text: "Local" }]}
        icon={linkIcon}
        actions={<LinkActionPanel baseUrl={LOCAL_URL} slug={slug} />}
      />
      <List.Section title="Staging">
        {pullRequests.map((pr) => (
          <List.Item
            key={pr.staging}
            title={makeGrapherURL(pr.staging, slug)}
            accessories={[{ text: "Staging" }]}
            icon={linkIcon}
            actions={<LinkActionPanel baseUrl={pr.staging} slug={slug} />}
          />
        ))}
      </List.Section>
    </List>
  );
}

function LinkActionPanel({ baseUrl, slug }: { baseUrl: string; slug: string }) {
  const url = makeGrapherURL(baseUrl, slug);
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
      <Action
        title={`Open Life Expectancy in ${BROWSER_NAME}`}
        icon={Icon.Globe}
        onAction={() =>
          open(makeGrapherURL(baseUrl, DEFAULT_SLUG), BROWSER_PATH)
        }
      />
    </ActionPanel>
  );
}
