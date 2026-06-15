const currentOrigin = window.location.hostname.includes('localhost')
  ? 'https://main--skillmappingdashboard--vishnuadobe.aem.page'
  : window.location.origin;

const adobeImsConfig = {
  clientId: 'adobe_skill_mapping',
  redirectUri: currentOrigin,
  postLogoutRedirectUri: currentOrigin,
  scopes: [
    'account_cluster.read',
    'additional_info.company',
    'additional_info.ownerOrg',
    'AdobeID',
    'avatar',
    'create_session',
    'exchange.openid-AdobeID-creative_cloud',
    'openid',
    'read_organizations',
    'read_pc',
  ],
  environment: window.location.hostname.includes('.live') ? 'prod' : 'stg1',
  authorizationEndpoint: 'https://ims-na1.adobelogin.com/ims/authorize/v2',
  tokenEndpoint: 'https://ims-na1.adobelogin.com/ims/token/v3',
  userInfoEndpoint: 'https://ims-na1.adobelogin.com/ims/userinfo/v2',
  revocationEndpoint: 'https://ims-na1.adobelogin.com/ims/revoke',
  protectedPaths: ['/'],
};

export default adobeImsConfig;
