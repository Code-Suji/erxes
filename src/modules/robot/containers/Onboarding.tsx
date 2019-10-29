import apolloClient from 'apolloClient';
import gql from 'graphql-tag';
import withCurrentUser from 'modules/auth/containers/withCurrentUser';
import { IUser } from 'modules/auth/types';
import React from 'react';
import { compose, graphql } from 'react-apollo';
import { withProps } from '../../common/utils';
import Onboarding from '../components/onboard/Onboarding';
import { FEATURE_DETAILS } from '../constants';
import { mutations, queries, subscriptions } from '../graphql';
import {
  ForceCompleteMutationResponse,
  GetAvailableFeaturesQueryResponse,
  IFeature
} from '../types';

type Props = {
  show: boolean;
  changeRoute: (route: string) => void;
  currentUser: IUser;
  onboardStep?: string;
};

type FinalProps = Props &
  ForceCompleteMutationResponse & {
    getAvailableFeaturesQuery?: GetAvailableFeaturesQueryResponse;
  };

class OnboardingContainer extends React.Component<
  FinalProps,
  { onboardStep?: string }
> {
  constructor(props: FinalProps) {
    super(props);

    this.state = { onboardStep: props.onboardStep };
  }

  changeStep = (step: string) => {
    const { getAvailableFeaturesQuery } = this.props;

    if (step === 'featureList' && getAvailableFeaturesQuery) {
      getAvailableFeaturesQuery.refetch();
    }

    this.setState({ onboardStep: step });
  };

  forceComplete = () => {
    this.props.forceCompleteMutation().then(() => {
      this.setState({ onboardStep: '' });
    });
  };

  componentDidMount() {
    if (window.location.href.includes('signedIn=true')) {
      setTimeout(() => {
        apolloClient.mutate({
          mutation: gql(mutations.checkStatus)
        });
      }, 4000);
    }
  }

  componentWillMount() {
    const { getAvailableFeaturesQuery, currentUser } = this.props;

    if (!getAvailableFeaturesQuery) {
      return;
    }

    getAvailableFeaturesQuery.subscribeToMore({
      document: gql(subscriptions.onboardingChanged),
      variables: { userId: currentUser._id },
      updateQuery: (prev, { subscriptionData: { data } }) => {
        const { onboardingChanged } = data;

        if (onboardingChanged) {
          const { type } = onboardingChanged;

          if (
            ['initial', 'inComplete'].includes(type) &&
            !this.state.onboardStep
          ) {
            this.setState({ onboardStep: type });
          }
        }
      }
    });
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.onboardStep !== this.props.onboardStep) {
      this.setState({ onboardStep: nextProps.onboardStep });
    }
  }

  render() {
    const { onboardStep } = this.state;
    const {
      getAvailableFeaturesQuery,
      currentUser,
      changeRoute,
      show
    } = this.props;

    const availableFeatures: IFeature[] = (getAvailableFeaturesQuery
      ? getAvailableFeaturesQuery.onboardingGetAvailableFeatures || []
      : []
    ).map(feature => {
      const details = FEATURE_DETAILS[feature.name] || {};

      return {
        ...feature,
        ...details
      };
    });

    return (
      <Onboarding
        show={show}
        currentUser={currentUser}
        onboardStep={onboardStep}
        changeStep={this.changeStep}
        changeRoute={changeRoute}
        forceComplete={this.forceComplete}
        availableFeatures={availableFeatures}
      />
    );
  }
}

export default withProps<Props>(
  compose(
    graphql<{}>(gql(queries.getAvailableFeatures), {
      name: 'getAvailableFeaturesQuery'
    }),
    graphql<{}>(gql(mutations.forceComplete), {
      name: 'forceCompleteMutation'
    })
  )(withCurrentUser(OnboardingContainer))
);
