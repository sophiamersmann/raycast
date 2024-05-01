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
  fetchSlugFromText,
  fetchChartId,
} from "./utils";

const GITHUB_REPO = "owid/owid-grapher";
const GITHUB_USER_NAME = "sophiamersmann";

const BROWSER_PATH = "/Applications/Google Chrome.app";
const BROWSER_NAME = "Google Chrome";

const ARC_PATH = "/Applications/Arc.app";

const LIVE_URL = "https://ourworldindata.org";
const LOCAL_URL = "http://localhost:3030";

const LIVE_ADMIN_URL = "https://admin.owid.io";

const DEFAULT_SLUG = "life-expectancy";

const GRAPHER_URL_REGEX =
  /^https?:\/\/.+\/grapher\/(?<slug>.+)\?(?<queryParams>.+)$/m;
const TEST_SVG_FILENAME_REGEX = /^svg\/(?<slug>.+)_v\d+.+$/m;
const TEST_SVG_FILENAME_REGEX_WITH_QUERY_PARAMS =
  /^all-views\/svg\/(?<slug>.+)\?(?<queryParams>.+)_v\d+.+$/m;

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
  const fromGrapherUrl = maybeSlugOrUrl.match(GRAPHER_URL_REGEX)?.groups;

  // check if the clipboard content is a filename from the owid-grapher-svgs repo
  const fromFilename =
    maybeSlugOrUrl.match(TEST_SVG_FILENAME_REGEX_WITH_QUERY_PARAMS)?.groups ??
    maybeSlugOrUrl.match(TEST_SVG_FILENAME_REGEX)?.groups;

  // check if the clipboard content is a valid slug associated with a chart
  const { slug: slugFromText, isLoading: isWaitingForSlug } =
    fetchSlugFromText(maybeSlugOrUrl);

  const slug =
    fromGrapherUrl?.slug ?? fromFilename?.slug ?? slugFromText ?? DEFAULT_SLUG;
  const queryParams = fromGrapherUrl?.queryParams ?? fromFilename?.queryParams;

  const { chartId, isLoading: isLoadingChartId } = fetchChartId(slug);

  const isLoading =
    isLoadingClipboardText ||
    isLoadingPullRequests ||
    isWaitingForSlug ||
    isLoadingChartId;

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
        title={makeGrapherURL(LIVE_URL, slug, queryParams)}
        accessories={[{ text: "Live" }]}
        icon={linkIcon}
        actions={
          <LinkActionPanel
            baseUrl={LIVE_URL}
            slug={slug}
            queryParams={queryParams}
            chartId={chartId}
          />
        }
      />
      <List.Item
        key="local"
        title={makeGrapherURL(LOCAL_URL, slug, queryParams)}
        accessories={[{ text: "Local" }]}
        icon={linkIcon}
        actions={
          <LinkActionPanel
            baseUrl={LOCAL_URL}
            slug={slug}
            queryParams={queryParams}
            chartId={chartId}
          />
        }
      />
      <List.Section key="Staging" title="Staging">
        {pullRequests.map((pr) => (
          <List.Item
            key={pr.staging}
            title={makeGrapherURL(pr.staging, slug, queryParams)}
            accessories={[{ date: pr.updatedAt }]}
            icon={linkIcon}
            actions={
              <LinkActionPanel
                baseUrl={pr.staging}
                slug={slug}
                queryParams={queryParams}
                chartId={chartId}
              />
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function LinkActionPanel({
  baseUrl,
  slug,
  chartId,
  queryParams,
}: {
  baseUrl: string;
  slug: string;
  chartId?: number;
  queryParams?: string;
}) {
  const url = makeGrapherURL(baseUrl, slug, queryParams);

  let chartEditorUrl = "";
  if (chartId) {
    const editorBaseUrl = baseUrl === LIVE_URL ? LIVE_ADMIN_URL : baseUrl;
    chartEditorUrl = `${editorBaseUrl}/admin/charts/${chartId}/edit`;
  }

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
      <Action
        title="Open Chart Editor"
        icon={Icon.Pencil}
        onAction={() =>
          open(chartEditorUrl, baseUrl === LIVE_URL ? ARC_PATH : BROWSER_PATH)
        }
      />
      <Action.CopyToClipboard title="Copy Link" content={url} />
    </ActionPanel>
  );
}
