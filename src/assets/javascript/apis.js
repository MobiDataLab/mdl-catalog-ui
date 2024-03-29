'use strict';

const dummy = {
  loading: {
    preferred: 'Loading...',
    versions: {
      'Loading...': {
        info: {
          description: 'Please wait...',
          title: 'Loading...'
        }
      }
    }
  }
};

const integrations = [
 { "text": "Swagger UI", "template": "http://petstore.swagger.io/?url={swaggerUrl}" },
 { "text": "Swagger Editor", "template": "http://editor.swagger.io/?url={swaggerUrl}" },
 { "text": "OpenAPI-GUI", "template": "https://mermade.github.io/openapi-gui/?url={swaggerUrl}" },
 { "text": "Stoplight Elements", "template": "https://elements-demo.stoplight.io/?spec={swaggerUrl}" }
];

const monthAgo = new Date(new Date().setDate(new Date().getDate()-30));
let category = '';
let categories = [];
let tag = '';
let status = '';
let newData = false;

const renderer = new window.marked.Renderer();
renderer.code = function(code, language) { return '' };
renderer.table = function(header, body) { return '' };
renderer.heading = function(text, number) { return `<h3>${text}</h3\n` };
renderer.link = function(href, title, text) { return text };
renderer.image = function(href, title, text) { return '' };

function debounce(func, wait, immediate) { // from underscore.js, MIT license
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

function CardModel() {
    this.classes = '';
    this.flashText = '';
    this.flashTitle = '';
    this.preferred = '';
    this.api = '';
    this.info = '';
    this.logo = '';
    this.externalUrl = '';
    this.versions = null;
    this.markedDescription = '';
    this.cardDescription = '';
    this.added = null;
    this.updated = null;
    this.noLogoUrl = 'https://mobidatalab.github.io/mdl-catalog-ui/assets/images/no-logo.svg';
}

CardModel.prototype.fromAPIs = function(apis) {
    this.preferred = apis.preferred;
    this.api = apis.versions[this.preferred];
    this.info = this.api.info;
    this.externalDocs = this.api.externalDocs || {};
    this.contact = this.info.contact || {};
    this.externalUrl = this.externalDocs.url || this.contact.url;
    this.logo = this.info['x-logo'] || {};
    if (this.api.info['x-origin']) {
      this.origUrl = this.api.info['x-origin'][0].url;
    }
    else {
      this.origUrl = this.api.swaggerUrl;
    }
    this.added = new Date(apis.added);
    this.updated = this.added;
    const that = this;

    var versions = [];
    $.each(apis.versions, function (version, api) {
        if (api.updated) {
            let updatedDate = new Date(api.updated);
            if (updatedDate > that.updated) {
                that.updated = updatedDate;
            }
        }
        if (version === this.preferred) {
            return;
        }
        versions.push({
            version: version,
            swaggerUrl: api.swaggerUrl,
            swaggerYamlUrl: api.swaggerYamlUrl
        });
    });
    if (this.added >= monthAgo) {
        this.classes = 'flash flash-green';
        this.flashText = 'New!';
        this.flashTitle = this.added.toLocaleString();
    }
    else if (this.updated >= monthAgo) {
        this.classes = 'flash flash-yellow';
        this.flashText = 'Updated';
        this.flashTitle = this.updated.toLocaleString();
    }
    if (this.api.info['x-tags'] && this.api.info['x-tags'].indexOf('helpWanted')>=0) {
        const link = (this.api.info['x-issues']||['https://github.com/mobidatalab/mdl-catalog-api/issues'])[0];
        this.classes = 'flash flash-red';
        this.flashText = `<a href="${link}" target="_blank">Help Wanted</a>`;
        this.flashTitle = this.updated.toLocaleString();
    }

    this.versions = versions.length > 1 ? versions : null;
    this.markedDescription = window.marked(this.info.description || '', { renderer });
    this.cardDescription = this.markedDescription.replace(/(<([^>]+)>)/gi, "").split(" ").splice(0,50).join(" ");
    this.integrations = [];
    for (let i of integrations) {
        this.integrations.push({ text: i.text, template: i.template.replace('{swaggerUrl}',this.api.swaggerUrl) });
    }

    return this;
};

if (window.$) {
  $(document).ready(function () {
    var cardTemplateSrc = document.querySelector('script[type="text/dot-template"]').innerText;
    var cardTemplate = window.doT.compile(cardTemplateSrc);
    const loadedData = {};

    var updateCards = function(data) {
        var fragment = $(document.createDocumentFragment());
        var priorityList = [];
        $.each(data, function (name, apis) {
            var model = new CardModel().fromAPIs(apis);
            var view = cardTemplate(model);
            if (name.startsWith("mobidatalab")) {
              priorityList.push($(view));
            } else {
              fragment.append($(view));
            }
        });
        fragment.prepend(priorityList);
        $('#apis-list').append(fragment);
    };

    var filter = function(data, search, categories, tag, status) {
        var data1 = {};
        var checkboxOnlyOpenApi = $('#checkbox-only-open-api')[0];
        if (checkboxOnlyOpenApi.checked) {
          $.each(data, function (name, apis) {
            const version = apis.versions[apis.preferred];
            if (!version.swaggerUrl) return;
            data1[name] = apis;
          });
        }
        else {
          data1 = data;
        }


        if (!(search || categories.length || tag || status)) return data1;
        var result = {};
        $.each(data1, function (name, apis) {
            const version = apis.versions[apis.preferred];
            if (categories.length && !(version.info['x-apisguru-categories']||[]).some(cat => categories.indexOf(cat) > -1)) {
                return;
            }
            if (
                search &&
                !search
                    .match(/\w+/g)
                    .every(
                        (s) =>
                            [
                                name,
                                version.info.title || "",
                                version.info.description || "",
                                version.info["x-apisguru-categories"] || ""
                            ]
                                .join(" ")
                                .toLowerCase()
                                .indexOf(s) > -1
                    )
            ) {
                return;
            }
            result[name] = apis;
            // // old logic
            // if (search && name.toLowerCase().indexOf(search) >= 0) {
            //     result[name] = apis;
            // }
            // else {
            //     if (status === 'updated' && new Date(version.updated) >= monthAgo) {
            //         result[name] = apis;
            //     }
            //     if (status === 'new' && new Date(version.added) >= monthAgo) {
            //         result[name] = apis;
            //     }
            //     if (category && (version.info['x-apisguru-categories']||[]).indexOf(category)>=0) {
            //         result[name] = apis;
            //     }
            //     if (tag && (version.info['x-tags']||[]).indexOf(tag)>=0) {
            //         result[name] = apis;
            //     }
            // }
        });
        return result;
    };

    var onlyUnique = function(value, index, self) {
      return self.indexOf(value) === index;
    };
    var refreshSelectedCategories = function(categories) {
      $(`.checkbox-dropdown-list label`).removeClass("is-selected");
      categories = categories.map(cat => {
        let selected = $(`.checkbox-dropdown-list #label-cat-${cat}`);
        selected.addClass("is-selected");
        return selected.text().trim();
      });
      $(".checkbox-dropdown #selected-categories-text").text(
          categories.length
              ? `${categories.length} selected: ${categories.join(", ")}`
              : "Select one or more categories"
      );
    };

    var refreshData = function(data) {
        $('#apis-list').empty();

        let search = decodeURIComponent($('#search-input').val()).toLowerCase();
        if (search) {
          $('#btnCopy').show();
        }
        else {
          $('#btnCopy').hide();
        }

        let categories = $('.checkbox-dropdown-list .is-selected input').toArray().map(el => el.value);
        refreshSelectedCategories(categories);

        let searchParams = new URLSearchParams([
          ["q", search ? encodeURIComponent(search) : ''],
          ["category", categories.length ? categories.join(",") : '']
        ]);
        history.replaceState(null, '', new URL(`?${searchParams}`, window.location.href).toString());

        let result = filter(data, search, categories, tag, status);
        updateCards(result);
    };

    let urlParams = new URLSearchParams(location.search);
    if (urlParams.get('q')) {
        $('#search-input').val(decodeURIComponent(urlParams.get('q')));
    }
    if (urlParams.get('category')) {
        categories = decodeURIComponent(urlParams.get('category')).toLowerCase().split(",").map(s=>s.trim()).filter(onlyUnique);
        refreshSelectedCategories(categories);
    }
    if (urlParams.get('tag')) {
       tag = urlParams.get('tag');
    }
    if (urlParams.get('status')) {
       status = urlParams.get('status').toLowerCase();
    }
    if (urlParams.get('nd')) {
       newData = true;
    }

    function getLoadedData(){
      return loadedData;
    }

    async function setLoadedData(data){
      $.extend(true, getLoadedData(), data);
      // console.log(data);
      console.log(loadedData);
      return loadedData;
    }

    $.ajax({
      type: "GET",
      url: (newData ? "https://raw.githubusercontent.com/mobidatalab/mdl-catalog-api/gh-pages/v2/list.json" : "https://mobidatalab.github.io/mdl-catalog-api/v2/list.json"),
      dataType: 'json',
      cache: true,
      success: async function (data) {

        await setLoadedData(data);
        updateData();
      }
    });

    for (let i=0;i<15;i++) { updateCards(dummy); }

    function updateData() {
      $('#apis-list').empty();
      let search = decodeURIComponent($('#search-input').val()).toLowerCase();
      if (search || categories || tag || status) {
          let result = filter(getLoadedData(), search, categories, tag, status);
          updateCards(result);
      }
      else {
          updateCards(getLoadedData());
      }
    }

    function setupObserver() {
      var searchInput = $('#search-input')[0];
      searchInput.addEventListener('keyup', debounce(function() {
        refreshData(getLoadedData());
      }, 333), false);

      var checkboxOnlyOpenApi = $('#checkbox-only-open-api')[0];

      checkboxOnlyOpenApi.addEventListener('click', debounce(function() {
        refreshData(getLoadedData());
      }, 333), false);

      let categoriesInput = $('.checkbox-dropdown')[0];
      let categoriesMutationObserver = new MutationObserver(debounce(function(mutation) {
        // drop down is active, do nothing
        if (mutation[0].target.className.indexOf("is-active") > -1) {
          return;
        }
        refreshData(getLoadedData());
      }, 333), false);
      categoriesMutationObserver.observe(categoriesInput, {
        attributes: true
      });
    }

    setupObserver();

    $('#btnCopy').on('click',function(){
        $('#txtCopy').show();
        $('#txtCopy').val(window.location.href);
        $('#txtCopy').focus().select();
        document.execCommand('copy');
        $('#txtCopy').hide();
        $('#search-input').focus();
    });

  });
}
