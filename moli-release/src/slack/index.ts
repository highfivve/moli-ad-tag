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

  const webhookUrl: string | undefined = process.env.SLACK_WEBHOOK_URL;

  if (webhookUrl) {
    const webhook = new IncomingWebhook(webhookUrl);

    // Send slack notification in #ads-releases
    await webhook.send({
      channel: 'ads-releases',
      username: 'Ad-Tag Releases',
      icon_emoji: ':moneybag:',
      blocks: createBlocks(publisherName, release, true)
    });

    // Send slack notification in slack channel with the publisher.
    if (slackChannel) {
      await webhook.send({
        channel: slackChannel,
        username: 'Ad-Tag Release',
        icon_emoji: ':moneybag:',
        blocks: createBlocks(publisherName, release, false)
      });
    }
  } else {
    console.error(
      'You called the moli-release slack integration without defining the SLACK_WEBHOOK_URL environment variable'
    );
  }
};

/**
 * Creates the blocks for the release message for a new ad-tag.
 * @param publisher The name of the publisher.
 * @param release All information for this release.
 * @param addPublisherName Whether to include publisher name in the message.
 */
const createBlocks = (
  publisher: string,
  release: IAdTagRelease,
  addPublisherName: boolean
): (KnownBlock | Block)[] => {
  const changes = release.changelog.map(value => `\n- ${value}`).join('');

  const releaseUrl = `https://${publisher}.h5v.eu/${release.version}`;

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Neues Ad-Tag${addPublisherName ? ` für ${publisher}` : ''}`
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
