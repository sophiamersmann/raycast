import {
  Action,
  ActionPanel,
  Clipboard,
  List,
  Toast,
  Icon,
  showToast,
  open,
  Keyboard,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import {
  usePullRequests,
  linkIcon,
  validateSlug,
  fetchChartId,
  fetchRandomSlug,
  fetchVariables,
} from "./utils";

interface Data {
  clipboardText?: string;
  origin?: string;
  pathname?: string;
  queryParams?: string;
  slug?: string;
  chartId?: string;
  isAdminUrl?: boolean;
}

const GITHUB_REPO = "owid/owid-grapher";
const GITHUB_USER_NAME = "sophiamersmann";

const BROWSER_PATH = "/Applications/Google Chrome Dev.app";
const BROWSER_NAME = "Google Chrome";

const ARC_PATH = "/Applications/Arc.app";

const LIVE_URL = "https://ourworldindata.org";
const LOCAL_URL = "http://localhost:3030";

const LIVE_ADMIN_URL = "https://admin.owid.io";

const TEST_SVG_FILENAME_REGEX = /^svg\/(?<slug>.+)_v\d+.+$/m;
const TEST_SVG_FILENAME_REGEX_WITH_QUERY_PARAMS =
  /^all-views\/svg\/(?<slug>.+)\?(?<queryParams>.+)_v\d+.+$/m;

const VALID_URLS = [
  LIVE_URL,
  LIVE_ADMIN_URL,
  LOCAL_URL,
  "http://staging-site-",
];

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

  const content: Data = {};

  // check if the clipboard content is an OWID URL
  try {
    const url = new URL(maybeSlugOrUrl);
    if (VALID_URLS.some((validUrl) => url.origin.startsWith(validUrl))) {
      content.origin = url.origin;
      content.pathname = url.pathname;
      content.queryParams = url.search;
    }
  } catch (error) {
    // intentionally empty
  }

  if (content.pathname) {
    const isGrapherUrl = content.pathname.startsWith("/grapher/");
    if (isGrapherUrl) {
      content.slug = content.pathname.match(
        /^\/grapher\/(?<slug>.+)/m,
      )?.groups?.slug;
    }
    if (content.pathname.startsWith("/admin")) content.isAdminUrl = true;
    if (content.pathname.startsWith("/admin/charts"))
      content.chartId = content.pathname.match(
        /^\/admin\/charts\/(?<chartId>\d+).*/m,
      )?.groups?.chartId;
  }

  // check if the clipboard content is a filename from the owid-grapher-svgs repo
  const fromFilename =
    maybeSlugOrUrl.match(TEST_SVG_FILENAME_REGEX_WITH_QUERY_PARAMS)?.groups ??
    maybeSlugOrUrl.match(TEST_SVG_FILENAME_REGEX)?.groups;
  if (fromFilename) {
    content.slug = fromFilename.slug;
    content.pathname = `/grapher/${fromFilename.slug}`;
    content.queryParams = fromFilename.queryParams;
  }

  // check if the clipboard content is a valid slug associated with a chart
  const maybeUrlOrSlugSplitByQuestionMark = maybeSlugOrUrl.split("?");
  const { slug: slugFromText, isLoading: isWaitingForSlug } = validateSlug(
    maybeUrlOrSlugSplitByQuestionMark[0],
  );
  if (slugFromText) {
    content.slug = slugFromText;
    content.pathname = `/grapher/${slugFromText}`;
    content.queryParams = maybeUrlOrSlugSplitByQuestionMark[1];
  }

  // grab chart id if we have a grapher page slug
  const { chartId, isLoading: isLoadingChartId } = fetchChartId(
    content.slug ?? "",
  );
  if (chartId) content.chartId = chartId.toString();

  const isLoading =
    isLoadingClipboardText ||
    isLoadingPullRequests ||
    isWaitingForSlug ||
    isLoadingChartId;

  const liveOriginUrl = content.isAdminUrl ? LIVE_ADMIN_URL : LIVE_URL;

  return (
    <List isLoading={isLoading}>
      <List.Item
        key="prod"
        title={makeUrl(liveOriginUrl, content.pathname, content.queryParams)}
        accessories={[{ text: "Live" }]}
        icon={linkIcon}
        actions={<LinkActionPanel baseUrl={LIVE_URL} data={content} />}
      />
      <List.Item
        key="local"
        title={makeUrl(LOCAL_URL, content.pathname, content.queryParams)}
        accessories={[{ text: "Local" }]}
        icon={linkIcon}
        actions={<LinkActionPanel baseUrl={LOCAL_URL} data={content} />}
      />
      <List.Section key="Staging" title="Staging">
        {pullRequests.map((pr) => (
          <List.Item
            key={pr.staging}
            title={makeUrl(pr.staging, content.pathname, content.queryParams)}
            accessories={[{ date: pr.updatedAt }]}
            icon={linkIcon}
            actions={<LinkActionPanel baseUrl={pr.staging} data={content} />}
          />
        ))}
      </List.Section>
    </List>
  );
}

function LinkActionPanel({ baseUrl, data }: { baseUrl: string; data: Data }) {
  const url = makeUrl(baseUrl, data.pathname, data.queryParams);

  let chartEditorUrl = "";
  if (!data.isAdminUrl && data.chartId) {
    const editorBaseUrl = baseUrl === LIVE_URL ? LIVE_ADMIN_URL : baseUrl;
    chartEditorUrl = makeUrl(
      editorBaseUrl,
      `/admin/charts/${data.chartId}/edit`,
    );
  }

  const { slug: randomSlug, isLoading: isLoadingRandomSlug } =
    fetchRandomSlug();

  const { variables, isLoading: isLoadingVariables } = fetchVariables(
    data.slug ?? "",
  );

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
      <Action.CopyToClipboard
        title="Copy Link"
        content={url}
        shortcut={Keyboard.Shortcut.Common.Copy}
      />
      <ActionPanel.Section title="Related pages">
        {chartEditorUrl && (
          <Action
            title="Open Chart Editor"
            icon={Icon.Pencil}
            onAction={() =>
              open(
                chartEditorUrl,
                baseUrl === LIVE_URL ? ARC_PATH : BROWSER_PATH,
              )
            }
          />
        )}
        {!isLoadingVariables && variables.length === 1 && (
          <Action
            title="Open Metadata"
            icon={Icon.Receipt}
            onAction={() => {
              const variable = variables[0];
              open(
                `https://api.ourworldindata.org/v1/indicators/${variable.id}.metadata.json`,
                BROWSER_PATH,
              );
            }}
          />
        )}
      </ActionPanel.Section>
      <ActionPanel.Section title="More pages">
        <Action
          title="Open Life Expectancy Chart"
          icon={Icon.LineChart}
          onAction={() =>
            open(makeUrl(baseUrl, "/grapher/life-expectancy"), BROWSER_PATH)
          }
        />
        {!isLoadingRandomSlug && randomSlug && (
          <Action
            title="Open Random Chart"
            icon={Icon.LineChart}
            onAction={() =>
              open(makeUrl(baseUrl, `/grapher/${randomSlug}`), BROWSER_PATH)
            }
          />
        )}
      </ActionPanel.Section>
      {!isLoadingVariables && variables.length > 1 && (
        <ActionPanel.Section title="Variables Metadata">
          {variables.map((variable) => (
            <Action
              key={variable.id}
              title={variable.name}
              icon={Icon.Receipt}
              onAction={() => {
                open(
                  `https://api.ourworldindata.org/v1/indicators/${variable.id}.metadata.json`,
                  BROWSER_PATH,
                );
              }}
            />
          ))}
        </ActionPanel.Section>
      )}
    </ActionPanel>
  );
}

const makeUrl = (origin: string, pathname?: string, queryParams?: string) => {
  return origin + (pathname ?? "") + (queryParams ? `?${queryParams}` : "");
};
