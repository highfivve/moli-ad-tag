import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

const features = [
  {
    title: 'Easy to Use',
    imageUrl: 'img/easy-to-use.png',
    description: (
      <>
        Create your ad tag configuration, build the ad tag and put it along with the ad slots on
        your page. Done. Avoid bugs by using typescript and leverage the fully typed API.
      </>
    )
  },
  {
    title: 'Maximize competition',
    imageUrl: 'img/maximize.png',
    description: (
      <>Use Google Ad Manager, Prebid.js, Prebid Server and Amazon TAM to maximize your revenue.</>
    )
  },
  {
    title: 'Customize everything',
    imageUrl: 'img/customize.png',
    description: (
      <>
        Define when and where an ad slot should be loaded. Select the proper sizes based on flexible
        media queries and label conditions. A module system allows you to extend your ad request
        pipeline.
      </>
    )
  }
];

const demandSources = [
  {
    title: 'Google',
    description: (
      <>
        Google AdX and Open Bidding provide a strong foundation are come directly with your Google
        Ad Manager
      </>
    ),
    href: 'https://support.google.com/admanager/answer/6321605'
  },
  {
    title: 'Prebid.js',
    description: (
      <>
        The defacto standard for client side header bidding. Types for popular bidders are provided
        to ensure easy configuration.
      </>
    ),
    href: 'https://prebid.org/product-suite/prebid-js/'
  },
  {
    title: 'Prebid Server',
    description: (
      <>
        The open source server side header bidding implementation. Removes the burden from the
        client side to do all the heavy lifting. This requires prebid server instance.
      </>
    ),
    href: 'https://prebid.org/product-suite/prebid-server/'
  },
  {
    title: 'Amazon TAM',
    description: (
      <>
        The Amazon transparent ad marketplace. A server side header bidding solution like Google
        Open Bidding or Prebid Server.
      </>
    ),
    href: 'https://aps.amazon.com/aps/transparent-ad-marketplace/'
  }
];

function Feature({ imageUrl, title, description }) {
  const imgUrl = useBaseUrl(imageUrl);
  return (
    <div className={clsx('col col--4', styles.feature)}>
      {imgUrl && (
        <div className="text--center">
          <img className={styles.featureImage} src={imgUrl} alt={title} />
        </div>
      )}
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function DemandSource({ title, description, href }) {
  return (
    <div className="col col--3">
      <div className="card">
        <div className="card__header">
          <h3>{title}</h3>
        </div>
        <div className="card__body">{description}</div>
        <div className="card__footer">
          <a href={href} className="button button--outline button--primary button--block">
            Read more
          </a>
        </div>
      </div>
    </div>
  );
}

function Home() {
  const context = useDocusaurusContext();
  const { siteConfig = {} } = context;
  return (
    <Layout
      title={`${siteConfig.title}`}
      description="Description will go into a meta tag in <head />"
    >
      <header className={clsx('hero hero--primary', styles.heroBanner)}>
        <div className="container">
          <h1 className="hero__title">{siteConfig.title}</h1>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link
              className={clsx(
                'button button--outline button--secondary button--lg',
                styles.getStarted
              )}
              to={useBaseUrl('docs/')}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {features.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
            <div className="row margin-top--lg">
              <div className="col col--12 padding--md">
                <h1>Is this for me?</h1>
                <p>
                  You are a <strong>publisher</strong> and want to take control of your
                  monetization. Along with some IT folks this ad tag requires
                </p>
                <ul>
                  <li>Google Ad Manager as an ad server</li>
                  <li>a TCF 2.0 compliant CMP</li>
                </ul>
              </div>
            </div>

            <div className="row">
              <div className="col col--12">
                <h1>What is supported?</h1>
              </div>
            </div>

            <div className="row">
              {demandSources.map((props, idx) => (
                <DemandSource key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default Home;
