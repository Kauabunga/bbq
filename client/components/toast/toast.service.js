'use strict';

angular.module('bbqApp')
  .service('toastService', function ($mdToast, $log) {

    this.updateToast = () => {
      $log.debug('Update toast');
      return this.showActionToast({
        content: 'An update is ready',
        action: 'Reload'
      })
        .then(response => {
          if(response === 'ok'){
            window.location.reload();
          }
        });
    };



    this.showActionToast = ({content, action}) => {

      var toast = $mdToast.simple()
        .textContent(content)
        .action(action)
        //.highlightAction(true)
        //.highlightClass('md-accent')
        .position('bottom right')
        .hideDelay(false);
      return $mdToast.show(toast);
    };

    this.showSimpleToast = () => {
      return $mdToast.show(
        $mdToast.simple()
          .textContent('Simple Toast!')
          .position('bottom right')
          .hideDelay(8000)
      );
    };

  });