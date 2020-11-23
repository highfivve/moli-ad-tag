const refs = '%D';
const authorName = '%an';
const authorEmail = '%ae';
const subject = '%s';
const body = '%b';

// If you change this, you will also have to change the json schema below.
export const gitLogFormat = { refs, subject, body, author: { name: authorName, email: authorEmail } };

/**
 * Json schema for the output of the `git log` command.
 */
export interface IGitJsonLog {

  /**
   * references for this commit.
   */
  refs: string;

  /**
   * The subject of this commit.
   */
  subject: string;

  /**
   * The body of this commit.
   */
  body: string;

  /**
   * The author of this commit.
   */
  author: IGitAuthor;

}

export interface IGitAuthor {

  /**
   * The name of the commit author.
   */
  name: string;

  /**
   * The email of the commit author.
   */
  email: string;

}
