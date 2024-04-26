import { List, ActionPanel, Action, Icon, open } from "@raycast/api";
import { usePullRequests, makeGrapherURL, linkIcon } from "./utils";

const GITHUB_REPO = "owid/owid-grapher";
const GITHUB_USER_NAME = "sophiamersmann";

const BROWSER_PATH = "/Applications/Google Chrome.app";
const BROWSER_NAME = "Google Chrome";

const ARC_PATH = "/Applications/Arc.app";

const EXAMPLE_CHART_SLUG = "life-expectancy";

export default function Command() {
  const { pullRequests, isLoading } = usePullRequests(
    GITHUB_REPO,
    GITHUB_USER_NAME,
  );

  return (
    <List isLoading={isLoading}>
      {pullRequests.map((pr) => (
        <List.Item
          key={pr.branch}
          title={pr.branch}
          icon={linkIcon}
          accessories={[{ date: pr.updatedAt }]}
          actions={
            <ActionPanel>
              <Action
                title={`Open Chart in ${BROWSER_NAME}`}
                icon={Icon.LineChart}
                onAction={() =>
                  open(
                    makeGrapherURL(pr.staging, EXAMPLE_CHART_SLUG),
                    BROWSER_PATH,
                  )
                }
              />
              <Action
                title={`Open in ${BROWSER_NAME}`}
                icon={Icon.Globe}
                onAction={() => open(pr.staging, BROWSER_PATH)}
              />
              <Action
                title="Open in Little Arc"
                icon={Icon.Globe}
                onAction={() => open(pr.staging, ARC_PATH)}
              />
              <Action.CopyToClipboard title="Copy Link" content={pr.staging} />
              <Action.CopyToClipboard
                title="Copy Chart Link"
                content={makeGrapherURL(pr.staging, EXAMPLE_CHART_SLUG)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
