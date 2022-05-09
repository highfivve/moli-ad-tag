import { IncomingWebhook } from '@slack/webhook';
import { IAdTagRelease } from '../types/releasesJson';
import { Block, KnownBlock } from '@slack/types';

/**
 * Send slack notifications when a new ad-tag is released.
 * @param {object} config The config object for the slack notifications.
 * @param {IAdTagRelease} config.release The release object containing the changes, version, ...
 * @param {string} config.publisherName The name of the publisher the ad-tag is for.
 * @param {string?} config.slackChannel The name of the slack channel with the publisher (if existing).
 */
export const sendSlackMessage = async (config: {
  release: IAdTagRelease;
  publisherName: string;
  slackChannel?: string;
}): Promise<void> => {
  const { release, publisherName, slackChannel } = config;

  const webhook = new IncomingWebhook(
    'https://hooks.slack.com/services/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'
  );

  const adsReleasesBlocks = createBlocks(publisherName, release, !!slackChannel);

  // Send slack notification in #ads-releases
  await webhook.send({
    channel: 'ads-releases',
    username: 'Ad-Tag Releases',
    icon_emoji: ':moneybag:',
    blocks: adsReleasesBlocks
  });

  // Send slack notification in slack channel with the publisher.
  if (slackChannel) {
    await webhook.send({
      channel: slackChannel,
      username: 'Ad-Tag Release',
      icon_emoji: ':moneybag:',
      blocks: adsReleasesBlocks
    });
  }
};

/**
 * Creates the blocks for the release message for a new ad-tag.
 * @param publisher The name of the publisher.
 * @param release All information for this release.
 * @param publisherSlackChannel Whether this set of blocks will be published in the #ads-releases or in a publisher slack channel.
 */
const createBlocks = (
  publisher: string,
  release: IAdTagRelease,
  publisherSlackChannel: boolean
): (KnownBlock | Block)[] => {
  const changes = release.changelog.map(value => `\n- ${value}`).join('');

  const releaseUrl = `https://${publisher}.h5v.eu/${release.version}`;

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Neues Ad-Tag ${!publisherSlackChannel ? `für ${publisher}` : ''}`
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Neue Version:* ${release.version}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Änderungen:*${changes}`
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${releaseUrl}|${releaseUrl}>`
      }
    }
  ];
};
