'use strict';

angular.module('bbqApp')
  .directive('bbqLogin', function (Auth, $state, $log, $timeout, toastService, feedbackService, $localStorage, analyticsService) {
    return {
      templateUrl: 'components/bbq-login/bbq-login.html',
      restrict: 'EA',
      link: function (scope, element, attrs) {

        const TOKEN_TIMEOUT = 60000;

        return init();

        function init() {

          scope.state = $localStorage.loginState = $localStorage.loginState || {};

          if(scope.state.successfulTokenSent){
            scope.currentTokenTimeoutHandler = $timeout(() => {
              scope.tokenTimedout = true;
              scope.successfulResentToken = false;
            }, TOKEN_TIMEOUT);
          }


          scope.flashInput = _.throttle(flashInput, 700, true);
          scope.submitToken = _.throttle(submitToken, 2000, true);
          scope.submitEmail = _.throttle(submitEmail, 2000, true);
          scope.resendTokenEmail = _.throttle(resendTokenEmail, 2000, true);
          scope.reset = reset;
          scope.edit = edit;

          //TODO would this be better for both the app and web platforms if it was two routes?
          //     email address should ideally not be cached in url / storage
          document.addEventListener('backbutton', onBackKeyDown, false);
          scope.$on('$destroy', () => document.removeEventListener('backbutton', onBackKeyDown));


        }

        function edit(){

          return reset();
        }

        function reset(){
          scope.tokenTimedout = false;
          scope.successfulResentToken = false;

          scope.state.successfulTokenSent = false;
        }

        function onBackKeyDown(e) {
          if(scope.state.successfulTokenSent){
            e.preventDefault();
            scope.state.successfulTokenSent = false;
          }
        }

        function submitToken(form, registerToken){

          if( ! scope.state.email || ! registerToken || form.$invalid ){
            form.isRegisterTokenFocused = false;
            scope.flashInput('tokenFlashActive');
          }
          else if(! scope.submitting) {
            scope.submitting = true;
            scope.submittingFirstToken = true;

            return Auth.login({email: scope.state.email, registerToken})
            .then(response => {
              $log.debug('Successfully authenticated');

              $timeout(() => {
                $localStorage.loginState = {};
                feedbackService.sync();
                $timeout(gotoMain);
              });
            })
            .catch(err => {
              handleErrorResponse(err);

              let first = 0;
              let watcher = scope.$watch('state.registerToken', () => {
                if(first > 0){
                  form.registerToken.$error.token = false;
                  watcher();
                }
                first++
              });

              scope.submitting = false;
              scope.authenticated = false;
              form.registerToken.$error.token = true;
              scope.submittingFirstToken = false;
            });
          }
        }

        function gotoMain(){
          $state.go('main',{},{ location:'replace' });
        }


        function flashInput(prop){
          if(! scope[prop]){
            scope[prop] = true;
            $timeout.cancel(scope[prop + 'timeout']);
            scope[prop + 'timeout'] = $timeout(() => {
              scope[prop] = false;
              } , 800);
          }
        }

        function clearOnNextEmailInput(form){

          let first = 0;
          let watcher = scope.$watch('state.email', () => {
            if(first > 0){
              form.email.$error.domain = false;
              form.email.$error.email = false;
              watcher();
            }
            first++;
          });
        }

        function submitEmail(form, email){

          if( ! email || form.$invalid ){
            form.isEmailFocused = false;
            scope.flashInput('emailFlashActive');
            clearOnNextEmailInput(form);
          }
          else if(! scope.submitting ){

            $timeout(() => analyticsService.trackEvent('Login email attempt', email));

            scope.submitting = true;
            return $timeout(() => {
              return Auth.sendTokenEmail({email})
                .then(response => {
                  $log.debug('response ', response, scope.emailRegisterForm);
                  scope.state.successfulTokenSent = true;

                  scope.state.email = email;

                  scope.tokenTimedout = false;
                  $timeout.cancel(scope.currentTokenTimeoutHandler);

                  scope.currentTokenTimeoutHandler = $timeout(() => {
                    scope.tokenTimedout = true;
                    scope.successfulResentToken = false;
                    $timeout(() => analyticsService.trackEvent('Login email success', email));
                  }, TOKEN_TIMEOUT);
                })
                .catch(response => {
                  clearOnNextEmailInput(form);
                  $timeout(() => analyticsService.trackEvent('Login email failure', email));
                  return handleErrorResponse(response);
                })
                .finally(() => {
                  scope.submitting = false;
                });
            }, 0);
          }
        }

        function resendTokenEmail(email){
          $log.debug('resendTokenEmail', email);
          if(! scope.submitting && ! scope.successfulResentToken){
            scope.submitting = true;
            scope.submittingSecondToken = true;
            return Auth.sendTokenEmail({email})
              .then(response => {
                $log.debug('response ', response, scope.emailRegisterForm);
                scope.successfulResentToken = true;
                scope.tokenTimedout = false;
                $timeout.cancel(scope.currentTokenTimeoutHandler);
                scope.currentTokenTimeoutHandler = $timeout(() => {
                  scope.successfulResentToken = false;
                  scope.tokenTimedout = true;
                }, TOKEN_TIMEOUT);
              })
              .catch(handleErrorResponse)
              .finally(() => {
                scope.submitting = false;
                scope.submittingSecondToken = false;
              });
          }
        }


        function handleErrorResponse(response){

          $log.debug('Login error response', response);

          if(response && response.status <= 0){
            toastService.errorToast('You need to be online to login');
          }
          else if(response && response.status !== 401) {
            if(response.data && response.data.message){
              scope.flashInput('emailFlashActive');
              scope.flashInput('tokenFlashActive');
            }
            toastService.errorToast((response.data && response.data.message) || 'Something went wrong. Please try again.');
          }

        }

      }
    };
  });
