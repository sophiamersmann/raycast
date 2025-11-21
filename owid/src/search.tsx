import { ActionPanel, Action, List, Icon, Color } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { useState } from "react";
import { SearchResponse } from "./utils/types";

const OWID_SEARCH_API_URL = "https://ourworldindata.org/api/search";

export default function Command() {
  const [searchText, setSearchText] = useState("");

  const { data, isLoading } = useFetch<SearchResponse>(
    `${OWID_SEARCH_API_URL}?q=${encodeURIComponent(searchText)}`,
    {
      execute: searchText.trim().length > 0,
      keepPreviousData: true,
    },
  );

  const results = data?.results || [];

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search for charts on Our World in Data..."
      throttle
    >
      {searchText.trim().length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="Search Our World in Data"
          description="Type to search for charts on Our World in Data"
        />
      ) : results.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Binoculars}
          title="No Results Found"
          description={`No results for "${searchText}"`}
        />
      ) : (
        results.map((result) => {
          return (
            <List.Item
              key={result.url}
              title={result.title}
              icon={{
                source: Icon.LineChart,
                tintColor: {
                  light: Color.SecondaryText,
                  dark: Color.SecondaryText,
                  adjustContrast: true,
                },
              }}
              actions={
                <ActionPanel>
                  <Action.OpenInBrowser url={result.url} />
                  <Action.CopyToClipboard
                    title="Copy URL"
                    content={result.url}
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
