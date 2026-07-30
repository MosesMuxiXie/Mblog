(function () {
  'use strict';

  const STORAGE_KEY = 'mosankai-language';
  const ENGLISH = 'en';
  const CHINESE = 'zh-CN';

  const messages = {
    en: {
      common: {
        languageSwitcher: 'Choose display language',
        chinese: '中文',
        english: 'English'
      },
      home: {
        title: 'Mosankai',
        description: 'Mosankai — find a time or open the blog.',
        navigation: 'Main navigation',
        findatime: 'FIND A TIME',
        blog: 'BLOG'
      },
      blog: {
        title: 'Blog | Mosankai',
        explore: 'Explore.',
        shoot: 'Shoot.',
        write: 'Write.',
        authorLine: "A tank lover's personal blog",
        byAuthor: 'By Moses Xie',
        twitter: 'Twitter',
        facebook: 'Facebook',
        subscribeIcon: 'Subscribe',
        navigation: 'Blog navigation',
        home: 'HOME',
        articles: 'ARTICLES',
        suggest: 'SUGGEST',
        subscribe: 'SUBSCRIBE',
        about: 'ABOUT',
        findatime: 'FIND A TIME',
        admin: 'ADMIN',
        suggestComingSoon: 'The suggest feature is coming soon!',
        subscribeComingSoon: 'The subscribe feature is coming soon!',
        aboutComingSoon: 'The about section is coming soon!',
        imageAlt: 'Blog cover',
        anonymous: 'Anonymous',
        noPosts: 'No posts yet.',
        backToArticles: 'Back to Articles',
        comments: 'Comments',
        noComments: 'No comments yet.',
        yourName: 'Your name',
        yourComment: 'Your comment…',
        postComment: 'Post Comment'
      },
      findatime: {
        pageTitle: 'findatime · Schedule with ease',
        description: 'Quickly collect everyone’s availability without requiring an account.',
        backHome: 'Back to mosankai.com',
        adminLabel: 'Sign in to the findatime admin console',
        noLogin: 'No sign-in required ·',
        detectingTimezone: 'Detecting time zone…',
        heroTitle: 'Find a time that works for everyone',
        heroLead: 'Create a meeting, share the link, and let everyone select the times they can attend. Add up to 10 options.',
        createProgress: 'Creation progress',
        chooseDuration: 'Choose duration',
        addTimes: 'Add times',
        meetingName: 'Meeting name',
        meetingNameExample: 'For example: Project kickoff',
        meetingDuration: 'Meeting duration',
        durationHint: 'Choose from 30 minutes to 8 hours in 30-minute increments.',
        nextChooseTime: 'Next: choose times',
        date: 'Date',
        startTime: 'Start time',
        addTime: 'Add time',
        previous: 'Previous',
        createAndGetLink: 'Create and get link',
        loadingMeeting: 'Loading meeting…',
        voteEyebrow: 'findatime · Vote',
        availableOptions: 'Available time options:',
        bestMeetingTime: 'Best meeting time:',
        participants: 'Participants:',
        yourName: 'Your name',
        enterName: 'Enter your name',
        selectAvailable: 'Select the times you can attend',
        submitAvailability: 'Submit my availability',
        created: 'Created',
        shareTitle: 'Share the link with everyone',
        shareDescription: 'Anyone can open the link and submit their availability without signing in.',
        meetingLink: 'Meeting link',
        copyLink: 'Copy link',
        viewSummary: 'View summary',
        minutes: '{count} minutes',
        hour: '{count} hour',
        hours: '{count} hours',
        hourMinutes: '{hours} hour {minutes} minutes',
        hoursMinutes: '{hours} hours {minutes} minutes',
        selectedSlots: '{count} / 10 times selected',
        removeTime: 'Remove {time}',
        noSlots: 'No time options yet. Add one above.',
        currentTimezone: 'Current time zone: {timezone}',
        enterMeetingName: 'Enter a meeting name first.',
        chooseDateTime: 'Choose a date and time.',
        invalidLocalTime: 'This time does not exist in your current time zone. Choose another time.',
        duplicateTime: 'This time has already been added.',
        maximumTimes: 'You can add up to 10 times.',
        addAtLeastOne: 'Add at least one time.',
        creating: 'Creating…',
        createFailed: 'Could not create the meeting.',
        createFailedRetry: 'Could not create the meeting. Please try again later.',
        invalidDuration: 'Choose a duration from 30 minutes to 8 hours in 30-minute increments.',
        invalidTimezone: 'Your browser time zone is invalid.',
        invalidSlots: 'Choose 1–10 valid times on the hour or half hour.',
        copied: 'Copied',
        durationLabel: 'Duration: {duration}',
        timezoneLabel: 'Time zone: {timezone}',
        onePersonResponded: '1 person responded',
        peopleResponded: '{count} people responded',
        oneVote: '1 vote',
        votes: '{count} votes',
        selectedBy: 'Selected by: {names}',
        noOne: 'No one yet',
        meetingNotFound: 'This meeting could not be found.',
        loadFailed: 'Could not load the meeting.',
        enterParticipantName: 'Enter your name.',
        chooseAvailability: 'Select at least one time that works for you.',
        submitting: 'Submitting…',
        submitFailed: 'Could not submit your availability.',
        submitFailedRetry: 'Could not submit your availability. Please try again later.',
        availabilitySaved: 'Your availability is saved and the summary has been updated.'
      }
    },
    'zh-CN': {
      common: {
        languageSwitcher: '选择显示语言',
        chinese: '中文',
        english: 'English'
      },
      home: {
        title: 'Mosankai',
        description: 'Mosankai — 轻松约时间或浏览博客。',
        navigation: '主导航',
        findatime: '找时间',
        blog: '博客'
      },
      blog: {
        title: '博客 | Mosankai',
        explore: '探索。',
        shoot: '射击。',
        write: '写作。',
        authorLine: '一位坦克爱好者的个人博客',
        byAuthor: '作者：Moses Xie',
        twitter: 'Twitter',
        facebook: 'Facebook',
        subscribeIcon: '订阅',
        navigation: '博客导航',
        home: '首页',
        articles: '文章',
        suggest: '建议',
        subscribe: '订阅',
        about: '关于',
        findatime: '找时间',
        admin: '管理',
        suggestComingSoon: '建议功能即将上线！',
        subscribeComingSoon: '订阅功能即将上线！',
        aboutComingSoon: '关于页面即将上线！',
        imageAlt: '博客封面',
        anonymous: '匿名',
        noPosts: '还没有文章。',
        backToArticles: '返回文章列表',
        comments: '评论',
        noComments: '还没有评论。',
        yourName: '你的姓名',
        yourComment: '写下你的评论…',
        postComment: '发表评论'
      },
      findatime: {
        pageTitle: 'findatime · 轻松约时间',
        description: '无需登录，快速收集大家方便的约会时间。',
        backHome: '返回 mosankai.com',
        adminLabel: '登录 findatime 管理后台',
        noLogin: '无需登录 ·',
        detectingTimezone: '正在识别时区…',
        heroTitle: '找一个大家都方便的时间',
        heroLead: '创建约会、分享链接，让每个人勾选可参加的时间。最多添加 10 个选项。',
        createProgress: '创建进度',
        chooseDuration: '选择时长',
        addTimes: '添加时间',
        meetingName: '约会名称',
        meetingNameExample: '例如：项目启动会',
        meetingDuration: '约会时长',
        durationHint: '从 30 分钟到 8 小时，每 30 分钟一个选项。',
        nextChooseTime: '下一步：选择时间',
        date: '日期',
        startTime: '开始时间',
        addTime: '添加时间',
        previous: '上一步',
        createAndGetLink: '创建并获取链接',
        loadingMeeting: '正在载入约会…',
        voteEyebrow: 'findatime · 投票',
        availableOptions: '可供选择的时间段：',
        bestMeetingTime: '最优会议时间：',
        participants: '可参与人数：',
        yourName: '你的姓名',
        enterName: '输入姓名',
        selectAvailable: '勾选你方便参加的时间',
        submitAvailability: '提交我的时间',
        created: '创建成功',
        shareTitle: '把链接发给大家',
        shareDescription: '任何人都可以直接打开链接并提交方便的时间，无需登录。',
        meetingLink: '约会链接',
        copyLink: '复制链接',
        viewSummary: '查看汇总',
        minutes: '{count} 分钟',
        hour: '{count} 小时',
        hours: '{count} 小时',
        hourMinutes: '{hours} 小时 {minutes} 分钟',
        hoursMinutes: '{hours} 小时 {minutes} 分钟',
        selectedSlots: '已选择 {count} / 10 个时间',
        removeTime: '移除 {time}',
        noSlots: '还没有时间选项，先在上方添加一个。',
        currentTimezone: '当前时区：{timezone}',
        enterMeetingName: '请先填写约会名称',
        chooseDateTime: '请选择日期和时间',
        invalidLocalTime: '这个时间在当前时区不存在，请选择其他时间',
        duplicateTime: '这个时间已经添加过了',
        maximumTimes: '最多可以添加 10 个时间',
        addAtLeastOne: '请至少添加一个时间',
        creating: '正在创建…',
        createFailed: '创建失败',
        createFailedRetry: '创建失败，请稍后重试',
        invalidDuration: '时长必须为 30 分钟到 8 小时，并以 30 分钟递增',
        invalidTimezone: '浏览器时区无效',
        invalidSlots: '请选择 1–10 个有效的整点或半点时间',
        copied: '已复制',
        durationLabel: '时长：{duration}',
        timezoneLabel: '时区：{timezone}',
        onePersonResponded: '1 人已回应',
        peopleResponded: '{count} 人已回应',
        oneVote: '1 票',
        votes: '{count} 票',
        selectedBy: '选择者：{names}',
        noOne: '暂无人选择',
        meetingNotFound: '找不到这个约会',
        loadFailed: '加载失败',
        enterParticipantName: '请输入姓名',
        chooseAvailability: '请至少选择一个方便的时间',
        submitting: '正在提交…',
        submitFailed: '提交失败',
        submitFailedRetry: '提交失败，请稍后重试',
        availabilitySaved: '已保存你的时间，汇总结果已更新。'
      }
    }
  };

  function normalizeLanguage(value) {
    return /^zh(?:-|$)/i.test(String(value || '')) ? CHINESE : ENGLISH;
  }

  function storedLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === ENGLISH || stored === CHINESE ? stored : null;
    } catch {
      return null;
    }
  }

  function browserLanguage() {
    const primary = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages[0]
      : navigator.language;
    return normalizeLanguage(primary);
  }

  let language = storedLanguage() || browserLanguage();
  document.documentElement.lang = language;

  function getMessage(key) {
    return key.split('.').reduce((value, part) => value && value[part], messages[language])
      || key.split('.').reduce((value, part) => value && value[part], messages.en)
      || key;
  }

  function translate(key, parameters) {
    const template = String(getMessage(key));
    return template.replace(/\{(\w+)\}/g, (match, name) => (
      parameters && Object.prototype.hasOwnProperty.call(parameters, name)
        ? String(parameters[name])
        : match
    ));
  }

  function applyTranslations(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = translate(element.dataset.i18n);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      element.setAttribute('placeholder', translate(element.dataset.i18nPlaceholder));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      element.setAttribute('aria-label', translate(element.dataset.i18nAriaLabel));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(element => {
      element.setAttribute('title', translate(element.dataset.i18nTitle));
    });
    scope.querySelectorAll('[data-i18n-content]').forEach(element => {
      element.setAttribute('content', translate(element.dataset.i18nContent));
    });
    document.documentElement.lang = language;
  }

  function updateSwitcher() {
    const switcher = document.getElementById('language-switcher');
    if (!switcher) return;
    switcher.setAttribute('aria-label', translate('common.languageSwitcher'));
    switcher.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
  }

  function createSwitcher() {
    if (document.getElementById('language-switcher')) return;
    const switcher = document.createElement('div');
    switcher.id = 'language-switcher';
    switcher.className = 'language-switcher';
    switcher.setAttribute('role', 'group');
    switcher.innerHTML = `
      <button type="button" lang="zh-CN" data-language="${CHINESE}">${translate('common.chinese')}</button>
      <button type="button" lang="en" data-language="${ENGLISH}">${translate('common.english')}</button>
    `;
    switcher.addEventListener('click', event => {
      const button = event.target.closest('[data-language]');
      if (button) setLanguage(button.dataset.language);
    });
    document.body.appendChild(switcher);
    updateSwitcher();
  }

  function setLanguage(value, options) {
    const nextLanguage = normalizeLanguage(value);
    const shouldPersist = !options || options.persist !== false;
    language = nextLanguage;
    if (shouldPersist) {
      try {
        localStorage.setItem(STORAGE_KEY, language);
      } catch {
        // The language still changes for this page when storage is unavailable.
      }
    }
    applyTranslations(document);
    updateSwitcher();
    window.dispatchEvent(new CustomEvent('mosankai:languagechange', {
      detail: { language }
    }));
  }

  window.MosankaiI18n = {
    apply: applyTranslations,
    get language() {
      return language;
    },
    locale() {
      return language === CHINESE ? 'zh-CN' : 'en-US';
    },
    setLanguage,
    t: translate
  };

  document.addEventListener('DOMContentLoaded', () => {
    applyTranslations(document);
    createSwitcher();
  });
}());
