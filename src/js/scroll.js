var Scroll = (function() {

  var defaults = {
    container: "#message-list",
    message: ".message",
    placeholder: ".placeholder",
    seedElements: 50,
    gutter: 10,
    distanceFromBottom: 2000
  };

  // Utilities

  function throttle (callback, limit) {
    var wait = false;
    return function () {
      if (!wait) {
        requestAnimationFrame(callback);
        wait = true;
        setTimeout(function () {
            wait = false;
        }, limit);
      }
    }
  }

  var timeSince = (function() {
    var DURATION_IN_SECONDS = {
      epochs: ['year', 'month', 'day', 'hour', 'minute'],
      year: 31536000,
      month: 2592000,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    function getDuration(seconds) {
      var epoch, interval;

      for (var i = 0; i < DURATION_IN_SECONDS.epochs.length; i++) {
        epoch = DURATION_IN_SECONDS.epochs[i];
        interval = Math.floor(seconds / DURATION_IN_SECONDS[epoch]);
        if (interval >= 1) {
          return {
            interval: interval,
            epoch: epoch
          };
        }
      }
    };

    return function timeSince(date) {
      var seconds = Math.floor((new Date() - new Date(date)) / 1000);
      var duration = getDuration(seconds);
      var suffix = (duration.interval > 1 || duration.interval === 0) ? 's' : '';
      return duration.interval + ' ' + duration.epoch + suffix;
    };
  })();

  function hasParent(tgt, parentClass) {
    return tgt.closest(parentClass);
  };

  // Scroll Class

  function Scroll(options, api) {
    this.options = Object.assign({}, defaults, options);

    // Scroll Specific functionality
    // API specific
    this.messages = [];
    this.getMessages = api;
    this.pageToken = null;

    // DOM
    this.container = document.querySelector(this.options.container);
    this.placeHolderTemplate = document.querySelector(this.options.placeholder);
    this.messageTemplate = document.querySelector(this.options.message);
    this.messageNodes = [];
    this.placeholderNodes = [];

    // Placeholder Specific
    this.placeholder = {
      height: 0,
      width: 0
    };

    this.slidingWindowSize = 0;
    this.pivotElement = 0;

    // Top for next element to be added
    this.nextElemTop = 0;
    this.nextPlaceholderElemTop = 0;
    this.lastScrollAmount = this.lastCountedScroll = 0;
    this.requestInProgress = false;

    // Swipeable
    this.swipeTarget = null;
    this.initialX = 0;
    this.currentX = 0;
    this.isCardDragging = false;
    this.swipeTargetWidth = 0;
    this.isCardDragging = false;

  };

  Scroll.prototype.init = function() {
    // Attach Event Handlers
    this.setPlaceholderDimensions();
    this.viewportHeight = this.container.clientHeight;
    this.lastScrollAmount = this.container.scrollTop;

    // Attach Listeners
    this.container.addEventListener("scroll", () => {requestAnimationFrame(this.handleScroll.bind(this))});
    // window.addEventListener("resize", this.handleResize.bind(this));

    // Handle touch events
    // document.addEventListener('touchstart', this.startSwipe.bind(this));
    // document.addEventListener('touchmove', this.continueSwipe.bind(this));
    // document.addEventListener('touchend', this.endSwipe.bind(this));

    // Handle mouse events
    // document.addEventListener('mousedown', this.startSwipe.bind(this));
    // document.addEventListener('mousemove', this.continueSwipe.bind(this));
    // document.addEventListener('mouseup', this.endSwipe.bind(this));

    this.handleLoad();
  };

  Scroll.prototype.attachSwipeListeners = function(tgt) {

    if (tgt) {
      // Handle touch events
      tgt.addEventListener('touchstart', this.startSwipe.bind(this));
      tgt.addEventListener('touchmove', this.continueSwipe.bind(this));
      tgt.addEventListener('touchend', this.endSwipe.bind(this));

      // Handle mouse events
      tgt.addEventListener('mousedown', this.startSwipe.bind(this));
      tgt.addEventListener('mousemove', this.continueSwipe.bind(this));
      tgt.addEventListener('mouseup', this.endSwipe.bind(this));
    }
  }

  Scroll.prototype.getPlaceholder = function() {
    return this.placeHolderTemplate.cloneNode(true);
  };

  Scroll.prototype.getMessageNode = function() {
    return this.messageTemplate.cloneNode(true);
  };

  Scroll.prototype.setPlaceholderDimensions = function() {
    // Render placeholder offscreen, get dimensions and then remove
    var placeholder = this.getPlaceholder();
    placeholder.style.position = "absolute";
    placeholder.style.left = -1000 + "px";
    this.container.appendChild(placeholder);
    placeholder.classList.remove("hidden");
    this.placeholder.height = placeholder.offsetHeight;
    this.placeholder.width = placeholder.offsetWidth;
    this.container.removeChild(placeholder);
  };

  Scroll.prototype.handleLoad = function() {
    var clientHeight = document.documentElement.clientHeight;
    var viewPortItems = Math.floor(clientHeight/this.placeholder.height);
    var placeholdersToShow = viewPortItems + this.options.seedElements;
    this.slidingWindowSize = placeholdersToShow;
    this.createPlaceholders(placeholdersToShow);
    this.loadMessages(placeholdersToShow);
  }

  Scroll.prototype.createPlaceholders = function(num) {
    var lastNodeTop = this.nextPlaceholderElemTop;
    for (var i = 0; i < num; i++) {
      var placeholder = this.getPlaceholder();
      this.placeholderNodes.push(placeholder);
      placeholder.style.transform = "translateY(" + lastNodeTop + "px)";
      this.container.appendChild(placeholder);
      lastNodeTop += this.placeholder.height + this.options.gutter;
    }

    this.nextPlaceholderElemTop = lastNodeTop;
  }

  Scroll.prototype.loadMessages = function(nodes) {
    if (!this.requestInProgress) {
      this.requestInProgress = true;
      this.getMessages(nodes, this.pageToken).then(this.addMessages.bind(this));
    }
  }

  Scroll.prototype.addMessages = function(response) {
    this.requestInProgress = false;
    var offset = this.messages.length;

    this.pageToken = response.pageToken;
    this.messages = this.messages.concat(response.messages);
    this.replacePlaceHolders(offset);
  }

  Scroll.prototype.replacePlaceHolders = function(offset) {
    var messages = this.messages;
    var len = messages.length;
    var placeholders = this.container.querySelectorAll(".placeholder");
    var extraPlaceholders = placeholders.length - (len - offset);
    var nextNodeTop = this.nextElemTop;
    for (var i = offset; i < len; i++) {
      var currMessage = messages[i];
      var currentPlaceholder = placeholders[i - offset];


      // Reuse nodes if possible
      var messageNode;
      var useExisting = this.messageNodes.length && this.messageNodes[i - offset];
      if (useExisting) {
        messageItem = this.messageNodes[this.pivotElement];
        messageNode = messageItem.ref;
        messageNode.style.opacity = 0;
      } else {
        messageNode = this.getMessageNode();
        this.attachSwipeListeners(messageNode);
      }

      this.addContent(messageNode, currMessage);
      if (!useExisting) {
        this.container.appendChild(messageNode);
      }

      messageNode.setAttribute("data-id", i);
      messageNode.style.transform = "translateY(" + nextNodeTop + "px)";
      messageNode.style.opacity = 1;
      currentPlaceholder.style.opacity = 0;

      // Cache properties of message node
      var messageHeight = messageNode.offsetHeight;
      var messageWidth = messageNode.offsetWidth;

      var msgObj = {
        index: i,
        ref: messageNode,
        height: messageHeight,
        width: messageWidth,
        top: nextNodeTop
      }
      if (useExisting) {
        this.messageNodes[this.pivotElement] = msgObj;
        this.setNextPivotElement();
      } else {
        this.messageNodes.push(msgObj);
      }

      currentPlaceholder.classList.add("hidden");

      nextNodeTop += messageHeight + this.options.gutter;
    }

    // Clear remaining placeholders if any
    if (extraPlaceholders > 0) {
      for (var i = placeholders.length - 1; i >= extraPlaceholders; i--) {
        var currentPlaceholder = placeholders[i];
        currentPlaceholder.style.opacity = 0;
        currentPlaceholder.classList.add("hidden");
      }
    }

    this.nextElemTop = this.nextPlaceholderElemTop = nextNodeTop;
  }

  Scroll.prototype.addContent = function(node, message) {
    node.querySelector(".avatar").src = this.options.imageBasePath + message.author.photoUrl;
    node.querySelector(".avatar").alt = message.author.name + " profile picture";
    node.querySelector(".name").textContent = message.author.name;
    node.querySelector(".time").textContent = timeSince(message.updated) + " ago";
    node.querySelector("p").textContent = message.content;
  };

  Scroll.prototype.reusePlaceholders = function(num) {
    var nextElemTop = this.nextPlaceholderElemTop;
    var resuablePlaceholders = Math.min(this.placeholderNodes.length, num);
    var extraReqd = num - this.placeholderNodes.length;
    for (var i = 0; i < resuablePlaceholders; i++) {
      this.placeholderNodes[i].style.transform = "translateY(" + nextElemTop + "px)";
      this.placeholderNodes[i].style.opacity = 1;
      this.placeholderNodes[i].classList.remove("hidden");
      nextElemTop += this.options.gutter + this.placeholder.height;
    }

    if (extraReqd > 0) {
      for (var i = 0; i < extraReqd; i++) {
        var placeholder = this.getPlaceholder();
        placeholder.style.transform = "translateY(" + nextElemTop + "px)";
        placeholder.style.opacity = 1;
        placeholder.classList.remove("hidden");
        nextElemTop += this.options.gutter + this.placeholder.height;
      }
    }

    this.nextPlaceholderElemTop = nextElemTop;
  };

  Scroll.prototype.getLastMsgIndex = function() {
    var first = this.pivotElement;
    return first === 0
      ? this.messageNodes.length - 1
      : first - 1;
  };

  Scroll.prototype.setNextPivotElement = function() {
    var first = this.pivotElement;
    this.pivotElement = first === this.messageNodes.length - 1
      ? 0
      : first + 1;
  };

  Scroll.prototype.setPrevPivotElement = function() {
    var first = this.pivotElement;
    this.pivotElement = first === 0
      ? this.messageNodes.length - 1
      : first - 1;
  };

  Scroll.prototype.handleScroll = function() {
    var scrollTop = this.container.scrollTop;
    var scrollHeight = this.container.scrollHeight;
    var scrollAmt = scrollTop - this.lastScrollAmount;

    if(scrollAmt >= 0) {
      if (scrollTop + window.innerHeight >= scrollHeight - this.options.distanceFromBottom) {
        // Check if we already have messages available
        // this.pivotElement
        var messageNodes = this.messageNodes;
        //var lastItemInView = messageNodes[messageNodes.length - 1];
        var lastItemInView = messageNodes[this.getLastMsgIndex()];
        var lastItemIndex = lastItemInView.index;
        var numMessages = this.messages.length;
        var msgsAvailable = numMessages - lastItemIndex - 1;

        if (msgsAvailable > 0) {
          // Just reuse the top nodes

          while (scrollAmt > 0 && msgsAvailable > 0) {
            // Get the top node
            var firstItemIndex = this.pivotElement;
            var firstItem = this.messageNodes[firstItemIndex];
            var messageNode = firstItem.ref;

            // Add content to node
            this.addContent(messageNode, this.messages[++lastItemIndex]);

            // Transform
            var messageHeight = messageNode.offsetHeight;
            var messageWidth = messageNode.offsetWidth;
            var nodeTop = this.nextElemTop;
            messageNode.setAttribute("data-id", lastItemIndex);
            messageNode.style.transform = "translateY(" + nodeTop + "px)";
            messageNode.style.opacity = 1;

            // Push to messageNodes
            this.messageNodes[firstItemIndex] = {
              index: lastItemIndex,
              ref: messageNode,
              height: messageHeight,
              width: messageWidth,
              top: nodeTop
            };

            this.setNextPivotElement();

            scrollAmt -= (messageHeight + this.options.gutter);
            msgsAvailable--;

            this.nextElemTop = this.nextPlaceholderElemTop = nodeTop + messageHeight + this.options.gutter;
          }
        } else {
          // Else create placeholders and request content
          var numPlaceholders = Math.ceil(scrollAmt/this.placeholder.height);
          this.reusePlaceholders(Math.max(numPlaceholders, 30));
          this.loadMessages(30, this.pageToken);
        }
      }
      this.lastCountedScroll = this.lastScrollAmount = scrollTop;
    } else {
      var scrollAmtAbs = Math.abs(scrollTop - this.lastCountedScroll);
      var firstItemIndex = this.pivotElement;
      var firstItem = this.messageNodes[firstItemIndex];
      var itemId = firstItem.index;
      var lastItemIndex = this.getLastMsgIndex();

      var lastItem = this.messageNodes[lastItemIndex];
      var messageNode = lastItem.ref;
      var messageHeight = messageNode.offsetHeight;
      var replacedItems = 0;
      while (scrollAmtAbs >= messageHeight && itemId > 0) {
        // Get node to place before
        replacedItems++;
        

        // Get node to be reused
        // Add content to node
        this.addContent(messageNode, this.messages[--itemId]);

        // Transform
        messageHeight = messageNode.offsetHeight;
        var messageWidth = messageNode.offsetWidth;

        var nextNodePos = firstItem.top - this.options.gutter - messageHeight;

        messageNode.setAttribute("data-id", itemId);
        messageNode.style.transform = "translateY(" + nextNodePos + "px)";
        messageNode.style.opacity = 1;

        // Push to messageNodes
        this.messageNodes[lastItemIndex] = {
          index: itemId,
          ref: messageNode,
          height: messageHeight,
          width: messageWidth,
          top: nextNodePos
        };

        this.setPrevPivotElement();
        scrollAmtAbs -= (messageHeight + this.options.gutter);

        firstItemIndex = this.pivotElement;
        firstItem = this.messageNodes[firstItemIndex];
        itemId = firstItem.index;

        lastItemIndex = this.getLastMsgIndex();
        lastItem = this.messageNodes[lastItemIndex];
        messageNode = lastItem.ref;
        messageHeight = messageNode.offsetHeight;


        var lastElem = this.messageNodes[this.messageNodes.length - 1];
        this.nextElemTop = this.nextPlaceholderElemTop = lastElem.top + lastElem.height + this.options.gutter;
      }

      if (replacedItems > 0) {
        this.lastScrollAmount = this.lastCountedScroll = scrollTop;
      }
    }
  };

  Scroll.prototype.addNodes = function(count) {
    this.createPlaceholders(count);
    this.loadMessages(count);
  }

  Scroll.prototype.handleResize = function() {
    // console.log("resized");
    // Handle Resizing
    // To do
  };

  Scroll.prototype.getSwipeTargetIndex = function() {
    if (!this.swipeTarget) return;
    var id = this.swipeTarget.getAttribute("data-id");
    var firstItemId = this.messageNodes[this.pivotElement].index;
    var diff = id - firstItemId;
    var currentItemIndex = this.pivotElement + diff;
    var numMessageNodes = this.messageNodes.length;
    if (currentItemIndex >= numMessageNodes) {
      currentItemIndex = currentItemIndex - numMessageNodes;
    }
    return currentItemIndex;
  };

  Scroll.prototype.getSwipeTarget = function() {
    return this.messageNodes[this.getSwipeTargetIndex()];
  };

  Scroll.prototype.removeTransition = function() {

  }

  Scroll.prototype.removeAndMoveNodes = function(index) {
    var currentItem = this.messageNodes[index];
    var itemId = currentItem.index;
    var top = currentItem.top;
    var nodesLen = this.messageNodes.length;

    var i = index === nodesLen - 1 ? 0 : ++index;
    var currentNode = this.messageNodes[i];
    while (currentNode.index > itemId) {
      currentNode.ref.style.transition = "transform 150ms ease-in";
      currentNode.ref.style.transform = "translateY(" + top + "px)";

      currentNode.top = top;
      top += currentNode.height + this.options.gutter;
      i = i < nodesLen - 1 ? ++i : 0;
      currentNode = this.messageNodes[i];
    }

    // To do
    // Handle underlying array data structure for removed nodes
    this.nextElemTop = this.nextPlaceholderElemTop = top;
  };


  Scroll.prototype.startSwipe = function(ev) {
    if(this.swipeTarget) return;
    var target = ev.target;

    var parent = hasParent(target, this.options.message);

    if (!parent) return;
    this.swipeTarget = parent;

    this.swipeTargetWidth = this.swipeTarget.offsetWidth;
    this.initialX = ev.pageX || ev.touches[0].pageX;
    this.currentX = this.initialX;

    // ev.preventDefault();
  };

  Scroll.prototype.continueSwipe = function(ev) {

    if (!this.swipeTarget) return;
    this.currentX = ev.pageX || ev.touches[0].pageX;
    var difference = this.currentX - this.initialX;
    var ctx = this;
    window.requestAnimationFrame(function() {
      ctx.moveCard(difference);
    });
  };

  Scroll.prototype.endSwipe = function(ev) {
    if (!this.swipeTarget || !this.isCardDragging) return;
    var diff = this.currentX - this.initialX;
    var yTranslate = this.getSwipeTarget().top;
  
    var displacement = Math.abs(diff)/this.swipeTargetWidth;
    var initial = -diff;
    if (displacement < 0.55) {
      if (diff < 0) {
        initial = this.initialX - diff;
      }
      this.swipeTarget.style.transform = "translateY(" + yTranslate +"px)";
      this.swipeTarget.style.opacity = 1;
      this.swipeTarget.style.WebkitUserSelect = "text";
      this.swipeTarget.style.MozUserSelect = "text";
      this.swipeTarget.style.msUserSelect = "text";
      this.swipeTarget.style.userSelect = "text";
    }
    this.isCardDragging = false;
    this.swipeTarget = null;
  };

  Scroll.prototype.moveCard = function(diff) {
    if (!this.swipeTarget) return;
    this.isCardDragging = true;

    var yTranslate = this.getSwipeTarget().top;
    var opacity = (this.swipeTargetWidth - Math.abs(diff))/this.swipeTargetWidth;
    var displacement = Math.abs(diff)/this.swipeTargetWidth;


    var initial = -diff;
    this.swipeTarget.style.WebkitUserSelect = "none";
    this.swipeTarget.style.MozUserSelect = "none";
    this.swipeTarget.style.msUserSelect = "none";
    this.swipeTarget.style.userSelect = "none";
    this.swipeTarget.style.transition = "";
    this.swipeTarget.style.transform = "translate(" + diff + "px," + yTranslate + "px)";
    this.swipeTarget.style.opacity = opacity;

    if (displacement >= 0.55) {
      this.swipeTarget.style.opacity = 0;
      this.swipeTarget.style.userSelect = "initial";
      var targetIndex = this.getSwipeTargetIndex();
      this.removeAndMoveNodes(targetIndex);
      this.isCardDragging = false;
      this.swipeTarget = null;
    }
  };

  return Scroll;

})();