# Changelog

## Unreleased

### Test Mode [](https://jira.gutefrage.net/browse/GD-1293)

An ad tag can now be configured in a `test` environment, which means that neither DFP, Prebid nor A9 will be called
and a placeholder ad will be rendered instead.

This allows for fast prototyping in the beginning without any setup in any ad server.

### Allow prebid userSync customization [GD-950](https://jira.gutefrage.net/browse/GD-950)

A publisher can decide if the prebid user syncs should be triggered after 6 seconds (default prebid configuration)
or after all ads have been loaded. Define the [`userSync`](https://moli-api-docs.gutefrage.net/interfaces/_moli_.moli.headerbidding.prebidconfig.html#usersync)
property in the `prebid` configuration.

This featured require a new service, the SlotEventService, which can be used to manage ad events in general.

## v1.9.0

- Add dynamic way to create prebid listeners and upgrade dependencies ([GD-1278](https://jira.gutefrage.net/browse/GD-1278))
- Update npm dependencies [018e6f4a6](https://git.gutefrage.net/projects/GD/repos/moli-ad-tag/commits/018e6f4a62346b2706de944ea7dbc0aadd97b35a)

## v1.8.0

- Remove sizesSupport from global sizeConfig [GD-1148](https://jira.gutefrage.net/browse/GD-1148)